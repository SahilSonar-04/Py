import { runs, type Task } from "@trigger.dev/sdk/v3";

export async function triggerAndWaitOutsideTask<TPayload, TOutput>(
  task: Task<string, TPayload, TOutput>,
  payload: TPayload
): Promise<TOutput> {
  const handle = await task.trigger(payload);
  const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

  if (run.status !== "COMPLETED") {
    const message =
      "error" in run && run.error
        ? String((run.error as { message?: string }).message ?? run.error)
        : `Task ended with status: ${run.status}`;
    throw new Error(message);
  }

  return run.output as TOutput;
}