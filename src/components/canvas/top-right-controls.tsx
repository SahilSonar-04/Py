"use client";

import { useState } from "react";
import { Play, Clock, Loader2 } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

export function TopRightControls({
  workflowId,
  onToggleHistory,
  historyOpen,
}: {
  workflowId: string;
  onToggleHistory: () => void;
  historyOpen?: boolean;
}) {
  const { selectedNodeIds, isRunning, setRunning, clearSelection } = useCanvasStore();
  const [busy, setBusy] = useState(false);

  async function runWorkflow(scope: "FULL" | "PARTIAL" | "SINGLE") {
    if (busy) return;

    // Explicit confirmation for scoped runs, so a stale/accidental selection
    // can never silently produce a partial run again — this is the second
    // layer of defense on top of clearSelection() below.
    if (scope !== "FULL") {
      const label = scope === "SINGLE" ? "1 node" : `${selectedNodeIds.length} nodes`;
      const ok = window.confirm(
        `This will run only ${label} (everything else will be skipped, not re-run). Continue?\n\nClick Cancel, then click empty canvas space first, to run the FULL workflow instead.`
      );
      if (!ok) return;
    }

    setBusy(true);
    setRunning(true);
    try {
      const targetNodeIds =
        scope === "FULL" ? undefined : selectedNodeIds.length > 0 ? selectedNodeIds : undefined;

      // Capture-then-clear: scope for *this* run is already computed above,
      // so it's safe to clear canvas selection now. This is what prevents
      // the next Run click from silently inheriting this same scope.
      clearSelection();

      await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, targetNodeIds }),
      });
    } finally {
      setBusy(false);
    }
  }

  function handleRunClick() {
    if (selectedNodeIds.length === 1) runWorkflow("SINGLE");
    else if (selectedNodeIds.length > 1) runWorkflow("PARTIAL");
    else runWorkflow("FULL");
  }

  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-20 transition-transform duration-300 ease-in-out sm:right-4"
      style={{ transform: historyOpen ? "translateX(-380px)" : "translateX(0)" }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <Pill label="Est" value="0.00 M" />
        <Pill label="Bal" value="0.00 M" />

        <button
          suppressHydrationWarning
          onClick={handleRunClick}
          disabled={busy || isRunning}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-workflow-accent-400 bg-workflow-accent-500 text-white shadow-sm hover:bg-workflow-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          title={
            selectedNodeIds.length === 1
              ? "Run selected node"
              : selectedNodeIds.length > 1
              ? "Run selected nodes"
              : "Run Workflow"
          }
        >
          {busy || isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
        </button>

        <button
          suppressHydrationWarning
          onClick={onToggleHistory}
          className={`flex h-8 w-9 items-center justify-center rounded-lg border shadow-sm transition-colors ${
            historyOpen
              ? "border-workflow-accent-400 bg-workflow-accent-50 text-workflow-accent-600"
              : "border-gray-200 bg-white text-gray-800 hover:bg-gray-100"
          }`}
          title="Execution History"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur sm:inline-flex">
      <span className="text-gray-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}