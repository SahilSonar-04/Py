"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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

type StatusFilter = "All" | "SUCCESS" | "FAILED" | "PARTIAL" | "RUNNING" | "PENDING";

const FILTER_OPTIONS: StatusFilter[] = ["All", "SUCCESS", "FAILED", "PARTIAL", "RUNNING", "PENDING"];

function filterLabel(f: StatusFilter) {
  return f === "All" ? "All" : f[0] + f.slice(1).toLowerCase();
}

/** Renders any input/output value fully — pretty-printed JSON for objects/arrays,
 * plain text for strings — so nothing is silently truncated in the history panel. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"ui" | "api">("ui");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [filterOpen, setFilterOpen] = useState(false);

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

  const filteredRuns = useMemo(
    () => (statusFilter === "All" ? runs : runs.filter((r) => r.status === statusFilter)),
    [runs, statusFilter]
  );

  function toggleRun(runId: string) {
    setExpandedRunId((prev) => (prev === runId ? null : runId));
    setExpandedNodeIds(new Set());
  }

  function toggleNode(execId: string) {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(execId)) {
        next.delete(execId);
      } else {
        next.add(execId);
      }
      return next;
    });
  }

  return (
    <div
      className={`absolute right-0 top-0 z-30 flex h-full w-[360px] flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
        <h3 className="text-base font-semibold text-gray-900">Execution History</h3>
        <button
          onClick={onClose}
          className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          Close
        </button>
      </div>

      <div className="px-4 pt-3">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab("ui")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === "ui" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            UI Runs
          </button>
          <button
            onClick={() => setTab("api")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === "api" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            API Runs
          </button>
        </div>
      </div>

      {tab === "ui" ? (
        <>
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="text-sm font-medium text-gray-700">Run history</span>
            <div className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {filterLabel(statusFilter)}
                <ChevronDown className="h-3 w-3" />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-8 z-10 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {FILTER_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setStatusFilter(f);
                        setFilterOpen(false);
                      }}
                      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                        statusFilter === f ? "font-medium text-gray-900" : "text-gray-600"
                      }`}
                    >
                      {filterLabel(f)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading && runs.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-gray-400">Loading...</p>
            )}
            {!loading && filteredRuns.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-gray-400">
                {runs.length === 0 ? "No runs yet." : "No runs match this filter."}
              </p>
            )}

            <div className="space-y-2">
              {filteredRuns.map((run) => {
                const isExpanded = expandedRunId === run.id;
                return (
                  <div key={run.id} className="rounded-lg border border-gray-200">
                    <button
                      onClick={() => toggleRun(run.id)}
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
                        {run.nodeExecutions.map((exec) => {
                          const nodeExpanded = expandedNodeIds.has(exec.id);
                          const hasDetails =
                            exec.inputs !== null && exec.inputs !== undefined
                              ? true
                              : exec.output !== null && exec.output !== undefined;
                          return (
                            <div key={exec.id} className="rounded bg-gray-50 px-2 py-1.5">
                              <button
                                onClick={() => toggleNode(exec.id)}
                                className="flex w-full items-center justify-between text-left"
                              >
                                <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-gray-700">
                                  {hasDetails &&
                                    (nodeExpanded ? (
                                      <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                                    ))}
                                  {NODE_STATUS_ICON[exec.status] ?? ""} {exec.nodeLabel ?? exec.nodeType}
                                </span>
                                {exec.durationMs !== null && (
                                  <span className="shrink-0 text-[10px] text-gray-400">
                                    {(exec.durationMs / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </button>

                              {/* Collapsed preview — single-line, truncated */}
                              {!nodeExpanded && exec.output ? (
                                <p className="mt-0.5 truncate text-[10px] text-gray-500">
                                  → {formatValue(exec.output).slice(0, 80)}
                                </p>
                              ) : null}
                              {!nodeExpanded && exec.error && (
                                <p className="mt-0.5 truncate text-[10px] text-red-500">{exec.error}</p>
                              )}

                              {/* Expanded — full, non-truncated detail: inputs, output, error, timing */}
                              {nodeExpanded && (
                                <div className="mt-1.5 space-y-1.5 border-t border-gray-200 pt-1.5">
                                  <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                                    <span>
                                      Started:{" "}
                                      {exec.startedAt ? new Date(exec.startedAt).toLocaleTimeString() : "—"}
                                    </span>
                                    <span>
                                      Finished:{" "}
                                      {exec.finishedAt ? new Date(exec.finishedAt).toLocaleTimeString() : "—"}
                                    </span>
                                  </div>

                                  {exec.inputs !== null && exec.inputs !== undefined && (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                        Inputs
                                      </p>
                                      <pre className="mt-0.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-white px-2 py-1.5 text-[10px] text-gray-700 ring-1 ring-gray-200">
                                        {formatValue(exec.inputs)}
                                      </pre>
                                    </div>
                                  )}

                                  {exec.output !== null && exec.output !== undefined && (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                        Output
                                      </p>
                                      <pre className="mt-0.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-white px-2 py-1.5 text-[10px] text-gray-700 ring-1 ring-gray-200">
                                        {formatValue(exec.output)}
                                      </pre>
                                    </div>
                                  )}

                                  {exec.error && (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                                        Error
                                      </p>
                                      <pre className="mt-0.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-600 ring-1 ring-red-200">
                                        {exec.error}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-gray-600">API runs aren&apos;t tracked yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Runs triggered directly via the API will show up here in a future update.
          </p>
        </div>
      )}
    </div>
  );
}