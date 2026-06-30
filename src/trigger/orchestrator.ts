import { task, runs } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { cropImageTask } from "./crop-image";
import { geminiTask } from "./gemini";
import type { PyEdge, PyNode } from "@/types/workflow";

export interface OrchestratorPayload {
  runId: string; // WorkflowRun.id in Postgres
  nodes: PyNode[];
  edges: PyEdge[];
  targetNodeIds?: string[]; // for SINGLE / PARTIAL scope - undefined means run all
}

/**
 * Resolves each node's upstream dependencies and only proceeds once they're
 * all settled. Independent branches execute concurrently and a node fires
 * the instant its own dependencies are ready - it never waits on sibling
 * nodes at the same DAG "level" that it doesn't actually depend on.
 */
export const orchestratorTask = task({
  id: "workflow-orchestrator",
  maxDuration: 600,
  run: async (payload: OrchestratorPayload) => {
    const { runId, nodes, edges, targetNodeIds } = payload;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const executeSet = new Set(
      targetNodeIds && targetNodeIds.length > 0 ? targetNodeIds : nodes.map((n) => n.id)
    );

    const upstream = new Map<
      string,
      { sourceNodeId: string; sourceHandle: string | null; targetHandle: string | null }[]
    >();
    for (const edge of edges) {
      const list = upstream.get(edge.target) ?? [];
      list.push({
        sourceNodeId: edge.source,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      });
      upstream.set(edge.target, list);
    }

    assertNoCycles(nodes, edges);

    const settled = new Map<string, Promise<Record<string, unknown>>>();

    function resolveNode(nodeId: string): Promise<Record<string, unknown>> {
      const existing = settled.get(nodeId);
      if (existing) return existing;

      const node = nodeMap.get(nodeId);
      if (!node) {
        const p = Promise.resolve({});
        settled.set(nodeId, p);
        return p;
      }

      const deps = upstream.get(nodeId) ?? [];

      const promise = (async () => {
        const depResults = await Promise.all(
          deps.map(async (d) => ({
            ...d,
            output: await resolveNode(d.sourceNodeId),
          }))
        );

        if (!executeSet.has(nodeId)) {
          await markSkipped(runId, node);
          return extractCachedOutput(node);
        }

        return executeNode(runId, node, depResults);
      })();

      settled.set(nodeId, promise);
      return promise;
    }

    await Promise.all(
      nodes.filter((n) => executeSet.has(n.id)).map((n) => resolveNode(n.id))
    );

    return { ok: true };
  },
});

async function executeNode(
  runId: string,
  node: PyNode,
  deps: {
    sourceNodeId: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    output: Record<string, unknown>;
  }[]
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
    } else if (node.type === "crop_image") {
      const data = node.data as {
        inputImageUrl: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      const inputImageUrl = resolveInput(deps, "input_image", data.inputImageUrl) as string;
      const x = (resolveInput(deps, "x", data.x) as number) ?? data.x;
      const y = (resolveInput(deps, "y", data.y) as number) ?? data.y;
      const width = (resolveInput(deps, "width", data.width) as number) ?? data.width;
      const height = (resolveInput(deps, "height", data.height) as number) ?? data.height;

      const result = await cropImageTask
        .triggerAndWait({ inputImageUrl, x, y, width, height })
        .unwrap();

      output = { output_image: result.outputImageUrl };
    } else if (node.type === "gemini") {
      const data = node.data as { model: string; prompt: string; systemPrompt: string };
      const prompt = (resolveInput(deps, "prompt", data.prompt) as string) ?? data.prompt;
      const systemPrompt =
        (resolveInput(deps, "system_prompt", data.systemPrompt) as string) ?? data.systemPrompt;
      const imageUrls = resolveAllInputs(deps, "image") as string[];

      const result = await geminiTask
        .triggerAndWait({ model: data.model, prompt, systemPrompt, imageUrls })
        .unwrap();

      output = { response: result.response };
    } else if (node.type === "response") {
      const collected: Record<string, unknown> = {};
      for (const d of deps) {
        const key = d.targetHandle ?? d.sourceNodeId;
        const value = d.sourceHandle ? d.output[d.sourceHandle] : d.output;
        collected[key] = value;
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
        output,
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
    throw err;
  }
}

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

function resolveInput(
  deps: { sourceHandle: string | null; targetHandle: string | null; output: Record<string, unknown> }[],
  targetHandle: string,
  fallback: unknown
): unknown {
  const match = deps.find((d) => d.targetHandle === targetHandle);
  if (!match) return fallback;
  const value = match.sourceHandle ? match.output[match.sourceHandle] : match.output;
  return value ?? fallback;
}

function resolveAllInputs(
  deps: { sourceHandle: string | null; targetHandle: string | null; output: Record<string, unknown> }[],
  targetHandle: string
): unknown[] {
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
