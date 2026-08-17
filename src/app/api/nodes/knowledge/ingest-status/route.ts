import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId query param required" }, { status: 400 });
  }

  try {
    const { runs } = await import("@trigger.dev/sdk/v3");
    const run = await runs.retrieve(runId);

    if (run.status === "COMPLETED") {
      const output = run.output as { chunkCount?: number } | undefined;
      return NextResponse.json({ status: "COMPLETED", chunkCount: output?.chunkCount ?? 0 });
    }
    if (run.status === "FAILED" || run.status === "CRASHED" || run.status === "CANCELED") {
      const errObj = (run as unknown as { error?: { message?: string } }).error;
      return NextResponse.json({
        status: "FAILED",
        error: errObj?.message ?? `Ingest ended with status: ${run.status}`,
      });
    }
    return NextResponse.json({ status: "RUNNING" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check ingest status" },
      { status: 500 }
    );
  }
}
