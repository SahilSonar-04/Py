"use client";

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import type { WorkflowRunView } from "@/types/workflow";

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700 border-green-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  PARTIAL: "bg-yellow-100 text-yellow-700 border-yellow-200",
  RUNNING: "bg-blue-100 text-blue-700 border-blue-200",
  PENDING: "bg-gray-100 text-gray-700 border-gray-200",
};

const NODE_STATUS_ICON: Record<string, string> = {
  SUCCESS: "✅",
  FAILED: "❌",
  RUNNING: "⏳",
  SKIPPED: "⏭️",
  PENDING: "⏸️",
};

export function HistoryPanel({
  workflowId,
  open,
  onClose,
}: {
  workflowId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState<WorkflowRunView[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function fetchRuns() {
      setLoading(true);
      try {
        const res = await fetch(`/api/runs?workflowId=${workflowId}`);
        const json = await res.json();
        if (!cancelled) setRuns(json.runs ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRuns();
    const interval = setInterval(fetchRuns, 3000); // light polling while a run may be active
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, workflowId]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[360px] flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Workflow History</h3>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && runs.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">Loading...</p>
        )}
        {!loading && runs.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">No runs yet.</p>
        )}

        <div className="space-y-2">
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <div key={run.id} className="rounded-lg border border-gray-200">
                <button
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )}
                      <span className="truncate text-xs font-medium text-gray-900">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_COLORS[run.status] ?? STATUS_COLORS.PENDING
                        }`}
                      >
                        {run.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{run.scope}</span>
                      {run.durationMs !== null && (
                        <span className="text-[10px] text-gray-400">
                          {(run.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-1.5 border-t border-gray-100 px-3 py-2.5">
                    {run.nodeExecutions.length === 0 && (
                      <p className="text-[11px] text-gray-400">No node executions recorded.</p>
                    )}
                    {run.nodeExecutions.map((exec) => (
                      <div key={exec.id} className="rounded bg-gray-50 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-[11px] font-medium text-gray-700">
                            {NODE_STATUS_ICON[exec.status] ?? ""} {exec.nodeLabel ?? exec.nodeType}
                          </span>
                          {exec.durationMs !== null && (
                            <span className="shrink-0 text-[10px] text-gray-400">
                              {(exec.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        {exec.output ? (
                          <p className="mt-0.5 truncate text-[10px] text-gray-500">
                            → {JSON.stringify(exec.output).slice(0, 80)}
                          </p>
                        ) : null}
                        {exec.error && (
                          // Was `truncate` (single-line, cuts mid-sentence) -
                          // now wraps fully so you can read the real error,
                          // which is exactly what you need to diagnose the
                          // Gemini model/API issue.
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-red-500">
                            {exec.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}