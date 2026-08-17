import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sourceId, query, topK } = body as {
    sourceId?: string;
    query?: string;
    topK?: number;
  };

  if (!sourceId || !query) {
    return NextResponse.json({ error: "sourceId and query are required" }, { status: 400 });
  }

  try {
    const { knowledgeRetrieveTask } = await import("@/trigger/knowledge");
    const { runs } = await import("@trigger.dev/sdk/v3");

    const handle = await knowledgeRetrieveTask.trigger({
      sourceId,
      query,
      topK: topK ?? 4,
    });
    const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (run.status !== "COMPLETED") {
      const errObj = (run as unknown as { error?: { message?: string } }).error;
      const message = errObj?.message ?? `Retrieve task ended with status: ${run.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const output = run.output as { chunks: string[] };
    return NextResponse.json({ chunks: output.chunks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Knowledge retrieval failed" },
      { status: 500 }
    );
  }
}
