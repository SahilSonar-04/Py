import { runs, type Task } from "@trigger.dev/sdk/v3";

/**
 * Triggers a task and waits for it to complete by polling its run status.
 *
 * triggerAndWait() can ONLY be called from inside another task's run()
 * function - it relies on the parent run's wait/resume mechanism. Calling it
 * from a plain Next.js API route (which is not a task context) throws
 * "triggerAndWait can only be used from inside a task.run()" immediately,
 * before the child task ever starts.
 *
 * This helper is the correct way to trigger-and-wait from outside a task:
 * trigger() returns a handle right away, then runs.poll() watches that run
 * until it reaches a terminal state.
 */
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