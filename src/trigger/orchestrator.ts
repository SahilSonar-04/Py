import { task, runs } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { cropImageTask, type CropImagePayload } from "./crop-image";
import { geminiTask, type GeminiTaskPayload } from "./gemini";
import { labelForResponseSource } from "@/lib/response-label";
import type { PyEdge, PyNode } from "@/types/workflow";

export interface OrchestratorPayload {
  runId: string;
  nodes: PyNode[];
  edges: PyEdge[];
  targetNodeIds?: string[];
}

type DepEdge = {
  edgeId: string;
  sourceNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

type ResolvedDep = DepEdge & { output: Record<string, unknown> };


export const orchestratorTask = task({
  id: "workflow-orchestrator",
  maxDuration: 600,
  run: async (payload: OrchestratorPayload) => {
    const { runId, nodes, edges, targetNodeIds } = payload;

    assertNoCycles(nodes, edges);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const executeSet = new Set(
      targetNodeIds && targetNodeIds.length > 0 ? targetNodeIds : nodes.map((n) => n.id)
    );

    const upstream = new Map<string, DepEdge[]>();
    for (const edge of edges) {
      const list = upstream.get(edge.target) ?? [];
      list.push({
        edgeId: edge.id,
        sourceNodeId: edge.source,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      });
      upstream.set(edge.target, list);
    }


    const nodePromises = new Map<string, Promise<Record<string, unknown>>>();

    function getNodeOutput(nodeId: string): Promise<Record<string, unknown>> {
      const existing = nodePromises.get(nodeId);
      if (existing) return existing;

      const promise = resolveNode(nodeId);
      nodePromises.set(nodeId, promise);
      return promise;
    }

    async function resolveNode(nodeId: string): Promise<Record<string, unknown>> {
      const node = nodeMap.get(nodeId);
      if (!node) return {};

      const depEdges = upstream.get(nodeId) ?? [];
      const deps: ResolvedDep[] = await Promise.all(
        depEdges.map(async (d) => ({ ...d, output: await getNodeOutput(d.sourceNodeId) }))
      );

      if (!executeSet.has(nodeId)) {
        await markSkipped(runId, node);
        return extractCachedOutput(node);
      }

      if (node.type === "crop_image") {
        return executeCropNode(runId, node, deps);
      }
      if (node.type === "gemini") {
        return executeGeminiNode(runId, node, deps);
      }
      return executeInlineNode(runId, node, deps, nodeMap);
    }

    try {
      await Promise.all(nodes.map((n) => getNodeOutput(n.id)));
    } catch (err) {
      // Safety net: force-fail anything left stuck in RUNNING so it never
      // hangs forever in the history panel.
      const message = err instanceof Error ? err.message : String(err);
      await prisma.nodeExecution.updateMany({
        where: { runId, status: "RUNNING" },
        data: { status: "FAILED", finishedAt: new Date(), error: message },
      });
      throw err;
    }

    return { ok: true };
  },
});

// ---------- Inline nodes (request / response) ----------

async function executeInlineNode(
  runId: string,
  node: PyNode,
  deps: ResolvedDep[],
  nodeMap: Map<string, PyNode>
): Promise<Record<string, unknown>> {
  const nodeExec = await prisma.nodeExecution.create({
    data: {
      runId,
      nodeId: node.id,
      nodeType: node.type ?? "unknown",
      nodeLabel: (node.data as { label?: string })?.label ?? null,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const start = Date.now();

  try {
    let output: Record<string, unknown> = {};

    if (node.type === "request") {
      const data = node.data as { fields: { id: string; name: string; value: string }[] };
      output = Object.fromEntries(data.fields.map((f) => [f.id, f.value]));
    } else if (node.type === "response") {
      const collected: Record<string, unknown> = {};
      for (const d of deps) {
        const sourceNode = nodeMap.get(d.sourceNodeId);
        const label = labelForResponseSource(sourceNode, d.sourceHandle);
        const value = d.sourceHandle ? d.output[d.sourceHandle] : d.output;
        collected[d.edgeId] = { label, value };
      }
      output = collected;
    }

    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs: Date.now() - start,
        inputs: deps.map((d) => ({ from: d.sourceNodeId, handle: d.sourceHandle })),
        output: output as object,
      },
    });

    return output;
  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return {};
  }
}

// ---------- Crop Image - single-node trigger + poll (no wait token) ----------

async function executeCropNode(
  runId: string,
  node: PyNode,
  deps: ResolvedDep[]
): Promise<Record<string, unknown>> {
  const data = node.data as { inputImageUrl: string; x: number; y: number; width: number; height: number };

  const payload: CropImagePayload = {
    inputImageUrl: (resolveInput(deps, "input_image", data.inputImageUrl) as string) ?? data.inputImageUrl,
    x: (resolveInput(deps, "x", data.x) as number) ?? data.x,
    y: (resolveInput(deps, "y", data.y) as number) ?? data.y,
    width: (resolveInput(deps, "width", data.width) as number) ?? data.width,
    height: (resolveInput(deps, "height", data.height) as number) ?? data.height,
  };

  const nodeExec = await prisma.nodeExecution.create({
    data: {
      runId,
      nodeId: node.id,
      nodeType: "crop_image",
      nodeLabel: (node.data as { label?: string })?.label ?? null,
      status: "RUNNING",
      startedAt: new Date(),
      inputs: deps.map((d) => ({ from: d.sourceNodeId, handle: d.sourceHandle })),
    },
  });

  const start = Date.now();

  try {
    const handle = await cropImageTask.trigger(payload);
    const result = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (result.status !== "COMPLETED") {
      const errObj = (result as unknown as { error?: { message?: string } }).error;
      throw new Error(errObj?.message ?? `Crop Image task ended with status: ${result.status}`);
    }

    const output = { output_image: result.output.outputImageUrl };
    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: { status: "SUCCESS", finishedAt: new Date(), durationMs: Date.now() - start, output: output as object },
    });
    return output;
  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return {};
  }
}

// ---------- Gemini - single-node trigger + poll (no wait token) ----------

async function executeGeminiNode(
  runId: string,
  node: PyNode,
  deps: ResolvedDep[]
): Promise<Record<string, unknown>> {
  const data = node.data as { model: string; prompt: string; systemPrompt: string };

  const payload: GeminiTaskPayload = {
    model: data.model,
    prompt: (resolveInput(deps, "prompt", data.prompt) as string) ?? data.prompt,
    systemPrompt: (resolveInput(deps, "system_prompt", data.systemPrompt) as string) ?? data.systemPrompt,
    imageUrls: resolveAllInputs(deps, "image") as string[],
  };

  const nodeExec = await prisma.nodeExecution.create({
    data: {
      runId,
      nodeId: node.id,
      nodeType: "gemini",
      nodeLabel: (node.data as { label?: string })?.label ?? null,
      status: "RUNNING",
      startedAt: new Date(),
      inputs: deps.map((d) => ({ from: d.sourceNodeId, handle: d.sourceHandle })),
    },
  });

  const start = Date.now();

  try {
    const handle = await geminiTask.trigger(payload);
    const result = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (result.status !== "COMPLETED") {
      const errObj = (result as unknown as { error?: { message?: string } }).error;
      throw new Error(errObj?.message ?? `Gemini task ended with status: ${result.status}`);
    }

    const output = { response: result.output.response };
    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: { status: "SUCCESS", finishedAt: new Date(), durationMs: Date.now() - start, output: output as object },
    });
    return output;
  } catch (err) {
    await prisma.nodeExecution.update({
      where: { id: nodeExec.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return {};
  }
}

// ---------- Shared helpers ----------

async function markSkipped(runId: string, node: PyNode) {
  await prisma.nodeExecution.create({
    data: {
      runId,
      nodeId: node.id,
      nodeType: node.type ?? "unknown",
      nodeLabel: (node.data as { label?: string })?.label ?? null,
      status: "SKIPPED",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 0,
    },
  });
}

function extractCachedOutput(node: PyNode): Record<string, unknown> {
  const data = node.data as unknown as Record<string, unknown>;
  if (node.type === "crop_image") return { output_image: data.outputImageUrl ?? "" };
  if (node.type === "gemini") return { response: data.response ?? "" };
  if (node.type === "request") {
    const fields = (data.fields as { id: string; value: string }[]) ?? [];
    return Object.fromEntries(fields.map((f) => [f.id, f.value]));
  }
  return {};
}

function resolveInput(deps: ResolvedDep[], targetHandle: string, fallback: unknown): unknown {
  const match = deps.find((d) => d.targetHandle === targetHandle);
  if (!match) return fallback;
  const value = match.sourceHandle ? match.output[match.sourceHandle] : match.output;
  return value ?? fallback;
}

function resolveAllInputs(deps: ResolvedDep[], targetHandle: string): unknown[] {
  return deps
    .filter((d) => d.targetHandle === targetHandle)
    .map((d) => (d.sourceHandle ? d.output[d.sourceHandle] : d.output))
    .filter(Boolean);
}

function assertNoCycles(nodes: PyNode[], edges: PyEdge[]) {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cycle detected at node ${id} - workflows must be a DAG`);
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) dfs(next);
    visiting.delete(id);
    visited.add(id);
  }

  for (const n of nodes) dfs(n.id);
}

export { runs };