"use client";

import { useRef, useState } from "react";
import { Play, Clock, Undo2, Redo2, Download, Upload, Loader2 } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import type { WorkflowGraph } from "@/types/workflow";

export function TopRightControls({
  workflowId,
  onToggleHistory,
}: {
  workflowId: string;
  onToggleHistory: () => void;
}) {
  const { nodes, edges, selectedNodeIds, isRunning, setRunning, undo, redo, past, future, setNodes, setEdges } =
    useCanvasStore();
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runWorkflow(scope: "FULL" | "PARTIAL" | "SINGLE") {
    if (busy) return;
    setBusy(true);
    setRunning(true);
    try {
      const targetNodeIds =
        scope === "FULL" ? undefined : selectedNodeIds.length > 0 ? selectedNodeIds : undefined;
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

  function exportJson() {
    const graph: WorkflowGraph = { nodes, edges };
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${workflowId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as WorkflowGraph;
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
        }
      } catch {
        // silently ignore malformed JSON for now
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-20 sm:right-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <Pill label="Est" value="0.00 M" />
        <Pill label="Bal" value="0.00 M" />

        <button
          onClick={undo}
          disabled={past.length === 0}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40"
          title="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40"
          title="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={exportJson}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          title="Export JSON"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          title="Import JSON"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importJson(file);
          }}
        />

        <button
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
          onClick={onToggleHistory}
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-100"
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
