import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { runWorkflowSchema } from "@/lib/schemas";
import type { WorkflowGraph } from "@/types/workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workflowId } = await params;
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = runWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { scope, targetNodeIds } = parsed.data;
  const graph = workflow.graph as unknown as WorkflowGraph;

  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      userId,
      status: "RUNNING",
      scope,
      targetNodeIds: targetNodeIds ?? undefined,
    },
  });

  await prisma.workflow.update({ where: { id: workflowId }, data: { status: "running" } });

  try {
    const { orchestratorTask } = await import("@/trigger/orchestrator");
    const { runs } = await import("@trigger.dev/sdk/v3");
    const handle = await orchestratorTask.trigger({
      runId: run.id,
      nodes: graph.nodes,
      edges: graph.edges,
      targetNodeIds: scope === "FULL" ? undefined : targetNodeIds,
    });

    runs
      .poll(handle.id, { pollIntervalMs: 1000 })
      .then(async (result) => {
        if (result.status === "COMPLETED") {
          await finalizeRun(run.id, workflowId);
        } else {
          const reason =
            "error" in result && result.error
              ? String((result.error as { message?: string }).message ?? result.error)
              : `Orchestrator run ended with status: ${result.status}`;
          await markRunFailed(run.id, workflowId, reason);
        }
      })
      .catch(async (err: unknown) => {
        console.error("Orchestrator failed:", err);
        await markRunFailed(run.id, workflowId, err instanceof Error ? err.message : String(err));
      });
  } catch (err) {
    await markRunFailed(run.id, workflowId, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Failed to start run", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ runId: run.id }, { status: 202 });
}

async function markRunFailed(runId: string, workflowId: string, errorMessage: string) {
  const existingCount = await prisma.nodeExecution.count({ where: { runId } });

  if (existingCount === 0) {
    await prisma.nodeExecution.create({
      data: {
        runId,
        nodeId: "orchestrator",
        nodeType: "orchestrator",
        nodeLabel: "Workflow startup",
        status: "FAILED",
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 0,
        error: errorMessage,
      },
    });
  }

  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "FAILED", finishedAt: new Date() },
  });
  await prisma.workflow.update({ where: { id: workflowId }, data: { status: "idle" } });
}

async function finalizeRun(runId: string, workflowId: string) {
  const executions = await prisma.nodeExecution.findMany({ where: { runId } });
  const hasFailed = executions.some((e: { status: string }) => e.status === "FAILED");
  const allSuccess = executions.every(
    (e: { status: string }) => e.status === "SUCCESS" || e.status === "SKIPPED"
  );

  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: hasFailed ? (allSuccess ? "PARTIAL" : "FAILED") : "SUCCESS",
      finishedAt: new Date(),
    },
  });
  await prisma.workflow.update({ where: { id: workflowId }, data: { status: "idle" } });
}