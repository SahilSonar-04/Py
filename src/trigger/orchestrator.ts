import { task, runs } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { cropImageTask, type CropImagePayload } from "./crop-image";
import { geminiTask, type GeminiTaskPayload } from "./gemini";
import { labelForResponseSource } from "@/lib/response-label";
import type { PyEdge, PyNode } from "@/types/workflow";

export interface OrchestratorPayload {
  runId: string; // WorkflowRun.id in Postgres
  nodes: PyNode[];
  edges: PyEdge[];
  targetNodeIds?: string[]; // for SINGLE / PARTIAL scope - undefined means run all
}

type DepEdge = {
  edgeId: string;
  sourceNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

type ResolvedDep = DepEdge & { output: Record<string, unknown> };

/**
 * IMPORTANT - Trigger.dev constraint driving this whole file's structure:
 *
 * A single task run can only have ONE wait token (wait.for(), triggerAndWait(),
 * batchTriggerAndWait(), etc.) in flight at a time. Calling triggerAndWait()
 * concurrently (e.g. inside Promise.all across independent DAG branches)
 * throws "Parallel waits are not supported" - and because that's a hard
 * SDK-level failure, node executions that were mid-flight when it happened
 * can be left stuck in RUNNING forever if we don't explicitly clean them up.
 *
 * The fix: resolve the workflow DAG in topological "waves" (Kahn's
 * algorithm). Within a wave, nodes of the SAME task type (all crop_image,
 * or all gemini) are triggered together via batchTriggerAndWait() - which
 * is Trigger.dev's purpose-built mechanism for awaiting many runs with a
 * SINGLE wait token. Different task types within a wave are awaited
 * sequentially (crop batch fully resolves, THEN gemini batch starts) so
 * there is never more than one wait in flight at once. request/response
 * nodes don't trigger external tasks at all, so they're resolved inline
 * and can run truly concurrently via Promise.all with no restriction.
 */
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
    const downstream = new Map<string, string[]>();
    for (const edge of edges) {
      const list = upstream.get(edge.target) ?? [];
      list.push({
        edgeId: edge.id,
        sourceNodeId: edge.source,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      });
      upstream.set(edge.target, list);

      const dlist = downstream.get(edge.source) ?? [];
      dlist.push(edge.target);
      downstream.set(edge.source, dlist);
    }

    const outputs = new Map<string, Record<string, unknown>>();
    const remainingDeps = new Map<string, number>();
    for (const n of nodes) {
      remainingDeps.set(n.id, (upstream.get(n.id) ?? []).length);
    }

    const processed = new Set<string>();
    let ready = nodes
      .filter((n) => (remainingDeps.get(n.id) ?? 0) === 0)
      .map((n) => n.id);

    try {
      while (ready.length > 0) {
        const wave = ready;
        ready = [];

        const depsFor = (nodeId: string): ResolvedDep[] =>
          (upstream.get(nodeId) ?? []).map((d) => ({
            ...d,
            output: outputs.get(d.sourceNodeId) ?? {},
          }));

        const skipIds: string[] = [];
        const inlineIds: string[] = [];
        const cropIds: string[] = [];
        const geminiIds: string[] = [];

        for (const nodeId of wave) {
          const node = nodeMap.get(nodeId);
          if (!node) {
            outputs.set(nodeId, {});
            continue;
          }
          if (!executeSet.has(nodeId)) {
            skipIds.push(nodeId);
          } else if (node.type === "crop_image") {
            cropIds.push(nodeId);
          } else if (node.type === "gemini") {
            geminiIds.push(nodeId);
          } else {
            inlineIds.push(nodeId);
          }
        }

        // Skipped nodes: no task trigger, just mark skipped + pass through
        // the last-known cached output. Safe to run concurrently - only
        // Prisma writes here, no Trigger.dev wait tokens involved.
        await Promise.all(
          skipIds.map(async (nodeId) => {
            const node = nodeMap.get(nodeId)!;
            await markSkipped(runId, node);
            outputs.set(nodeId, extractCachedOutput(node));
          })
        );

        // Inline nodes (request / response): resolved synchronously, no
        // external task trigger, so also safe to run concurrently.
        await Promise.all(
          inlineIds.map(async (nodeId) => {
            const node = nodeMap.get(nodeId)!;
            const output = await executeInlineNode(runId, node, depsFor(nodeId), nodeMap);
            outputs.set(nodeId, output);
          })
        );

        // Crop Image nodes: batch-trigger together as ONE wait token.
        if (cropIds.length > 0) {
          await executeCropBatch(runId, cropIds, nodeMap, depsFor, outputs);
        }

        // Gemini nodes: batch-trigger together as a second wait token,
        // started only AFTER the crop batch above has fully resolved -
        // never concurrently with it.
        if (geminiIds.length > 0) {
          await executeGeminiBatch(runId, geminiIds, nodeMap, depsFor, outputs);
        }

        for (const nodeId of wave) {
          processed.add(nodeId);
          for (const next of downstream.get(nodeId) ?? []) {
            const remaining = (remainingDeps.get(next) ?? 0) - 1;
            remainingDeps.set(next, remaining);
            if (remaining <= 0 && !processed.has(next)) {
              ready.push(next);
            }
          }
        }
      }
    } catch (err) {
      // Safety net: if anything above throws (e.g. a batch call itself
      // fails outright), make sure no NodeExecution is left stuck in
      // RUNNING forever - force-fail anything still open for this run.
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

// ---------- Inline nodes (request / response) - no external task trigger ----------

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
      // Keyed by edgeId (unique per connection), not targetHandle - every
      // edge into Response shares the same "result" targetHandle, so
      // keying by targetHandle would silently collapse multiple
      // connections down to just the last one. Each entry carries both
      // the derived display label and the resolved value, so the client
      // can render it without re-deriving anything.
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
    throw err;
  }
}

// ---------- Crop Image batch (one wait token for the whole wave) ----------

async function executeCropBatch(
  runId: string,
  nodeIds: string[],
  nodeMap: Map<string, PyNode>,
  depsFor: (nodeId: string) => ResolvedDep[],
  outputs: Map<string, Record<string, unknown>>
) {
  const execIds = new Map<string, string>();
  const items: { nodeId: string; deps: ResolvedDep[]; payload: CropImagePayload }[] = [];

  for (const nodeId of nodeIds) {
    const node = nodeMap.get(nodeId)!;
    const deps = depsFor(nodeId);
    const data = node.data as {
      inputImageUrl: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const inputImageUrl =
      (resolveInput(deps, "input_image", data.inputImageUrl) as string) ?? data.inputImageUrl;
    const x = (resolveInput(deps, "x", data.x) as number) ?? data.x;
    const y = (resolveInput(deps, "y", data.y) as number) ?? data.y;
    const width = (resolveInput(deps, "width", data.width) as number) ?? data.width;
    const height = (resolveInput(deps, "height", data.height) as number) ?? data.height;

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
    execIds.set(nodeId, nodeExec.id);
    items.push({ nodeId, deps, payload: { inputImageUrl, x, y, width, height } });
  }

  const start = Date.now();

  try {
    const result = await cropImageTask.batchTriggerAndWait(
      items.map((i) => ({ payload: i.payload }))
    );

    for (let i = 0; i < items.length; i++) {
      const { nodeId } = items[i];
      const execId = execIds.get(nodeId)!;
      const runResult = result.runs[i];

      if (runResult && runResult.ok) {
        const output = { output_image: runResult.output.outputImageUrl };
        outputs.set(nodeId, output);
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            output: output as object,
          },
        });
      } else {
        const errorMessage =
          runResult && "error" in runResult
            ? String((runResult.error as { message?: string })?.message ?? runResult.error)
            : "Crop Image task failed";
        outputs.set(nodeId, {});
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            error: errorMessage,
          },
        });
      }
    }
  } catch (err) {
    // The batch call itself failed outright (not a per-item failure) -
    // fail every node execution we opened for this batch.
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all(
      items.map(async ({ nodeId }) => {
        outputs.set(nodeId, {});
        const execId = execIds.get(nodeId)!;
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            error: message,
          },
        });
      })
    );
    throw err;
  }
}

// ---------- Gemini batch (one wait token for the whole wave) ----------

async function executeGeminiBatch(
  runId: string,
  nodeIds: string[],
  nodeMap: Map<string, PyNode>,
  depsFor: (nodeId: string) => ResolvedDep[],
  outputs: Map<string, Record<string, unknown>>
) {
  const execIds = new Map<string, string>();
  const items: { nodeId: string; deps: ResolvedDep[]; payload: GeminiTaskPayload }[] = [];

  for (const nodeId of nodeIds) {
    const node = nodeMap.get(nodeId)!;
    const deps = depsFor(nodeId);
    const data = node.data as { model: string; prompt: string; systemPrompt: string };

    const prompt = (resolveInput(deps, "prompt", data.prompt) as string) ?? data.prompt;
    const systemPrompt =
      (resolveInput(deps, "system_prompt", data.systemPrompt) as string) ?? data.systemPrompt;
    const imageUrls = resolveAllInputs(deps, "image") as string[];

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
    execIds.set(nodeId, nodeExec.id);
    items.push({ nodeId, deps, payload: { model: data.model, prompt, systemPrompt, imageUrls } });
  }

  const start = Date.now();

  try {
    const result = await geminiTask.batchTriggerAndWait(
      items.map((i) => ({ payload: i.payload }))
    );

    for (let i = 0; i < items.length; i++) {
      const { nodeId } = items[i];
      const execId = execIds.get(nodeId)!;
      const runResult = result.runs[i];

      if (runResult && runResult.ok) {
        const output = { response: runResult.output.response };
        outputs.set(nodeId, output);
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            output: output as object,
          },
        });
      } else {
        const errorMessage =
          runResult && "error" in runResult
            ? String((runResult.error as { message?: string })?.message ?? runResult.error)
            : "Gemini task failed";
        outputs.set(nodeId, {});
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            error: errorMessage,
          },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all(
      items.map(async ({ nodeId }) => {
        outputs.set(nodeId, {});
        const execId = execIds.get(nodeId)!;
        await prisma.nodeExecution.update({
          where: { id: execId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            durationMs: Date.now() - start,
            error: message,
          },
        });
      })
    );
    throw err;
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

function resolveInput(
  deps: ResolvedDep[],
  targetHandle: string,
  fallback: unknown
): unknown {
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