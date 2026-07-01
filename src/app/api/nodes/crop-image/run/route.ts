import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cropImageTaskInputSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = cropImageTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { cropImageTask } = await import("@/trigger/crop-image");
    const { runs } = await import("@trigger.dev/sdk/v3");

    // IMPORTANT: triggerAndWait() only works when called from *inside*
    // another running task - it relies on a waitpoint tied to the current
    // run's execution context. An API route has no such context, so calling
    // it here throws immediately. That's why this per-node "Run" button was
    // failing while the full/orchestrated run (which calls triggerAndWait
    // from inside orchestratorTask) worked fine. Trigger standalone instead,
    // then poll for the result.
    const handle = await cropImageTask.trigger(parsed.data);
    const run = await runs.poll(handle.id, { pollIntervalMs: 2000 });

    if (run.status !== "COMPLETED") {
      const errObj = (run as unknown as { error?: { message?: string } }).error;
      const message = errObj?.message ?? `Task ended with status: ${run.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const output = run.output as { outputImageUrl?: string } | undefined;
    if (!output?.outputImageUrl) {
      return NextResponse.json(
        { error: "Task completed but returned no output" },
        { status: 500 }
      );
    }

    return NextResponse.json({ outputImageUrl: output.outputImageUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crop Image task failed" },
      { status: 500 }
    );
  }
}