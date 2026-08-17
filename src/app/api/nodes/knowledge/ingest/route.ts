import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { knowledgeIngestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = knowledgeIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { text, sourceName, workflowId, nodeId } = parsed.data;

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    const existing = await prisma.knowledgeSource.findFirst({ where: { workflowId, nodeId } });
    if (existing) {
      await prisma.knowledgeSource.delete({ where: { id: existing.id } });
    }

    const source = await prisma.knowledgeSource.create({
      data: { userId, nodeId, workflowId, name: sourceName },
    });

    const { knowledgeIngestTask } = await import("@/trigger/knowledge");
    const handle = await knowledgeIngestTask.trigger({ sourceId: source.id, text });

    return NextResponse.json({ sourceId: source.id, runId: handle.id }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start ingest" },
      { status: 500 }
    );
  }
}
