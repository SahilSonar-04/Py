import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { agentTaskInputSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = agentTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { agentTask } = await import("@/trigger/agent");
    const { runs } = await import("@trigger.dev/sdk/v3");

    const handle = await agentTask.trigger({
      prompt: parsed.data.prompt,
      enabledTools: parsed.data.enabledTools,
      knowledgeSourceId: parsed.data.knowledgeSourceId,
    });
    const run = await runs.poll(handle.id, { pollIntervalMs: 2000 });

    if (run.status !== "COMPLETED") {
      const errObj = (run as unknown as { error?: { message?: string } }).error;
      const message = errObj?.message ?? `Task ended with status: ${run.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const output = run.output as { response?: string; toolCallLog?: unknown[] } | undefined;
    if (output?.response === undefined) {
      return NextResponse.json(
        { error: "Task completed but returned no output" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: output.response,
      toolCallLog: output.toolCallLog ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent task failed" },
      { status: 500 }
    );
  }
}
