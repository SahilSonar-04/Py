"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import {
  downloadWorkflowJson,
  parseWorkflowImport,
  ensureLockedNodesPresent,
  WorkflowImportError,
} from "@/lib/workflow-io";

export function WorkflowHeader({ workflowId }: { workflowId: string }) {
  const workflowName = useCanvasStore((s) => s.workflowName);
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const [name, setName] = useState(workflowName);
  const [syncedName, setSyncedName] = useState(workflowName);
  const [importing, setImporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (workflowName !== syncedName) {
    setSyncedName(workflowName);
    setName(workflowName);
  }

  function handleChange(value: string) {
    setName(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setWorkflow(workflowId, value, nodes, edges);
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
    }, 600);
  }

  function handleExport() {
    downloadWorkflowJson(name, nodes, edges);
  }

  async function handleImportFile(file: File) {
    const ok = window.confirm(
      "Importing will replace everything currently on this canvas. Continue?"
    );
    if (!ok) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseWorkflowImport(text);
      const nextNodes = ensureLockedNodesPresent(parsed.nodes);
      const nextName = parsed.name ?? workflowName;

      setWorkflow(workflowId, nextName, nextNodes, parsed.edges);

      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          graph: { nodes: nextNodes, edges: parsed.edges },
        }),
      });
    } catch (err) {
      alert(err instanceof WorkflowImportError ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 sm:left-4">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/85 px-2 py-1.5 shadow-md backdrop-blur">
        <Link
          href="/dashboard"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          suppressHydrationWarning
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={120}
          placeholder="Untitled"
          className="h-8 w-[160px] bg-transparent text-sm font-normal text-gray-900 outline-none placeholder:text-gray-400 sm:w-[200px]"
        />

        <div className="mx-0.5 h-5 w-px bg-gray-200" />

        <button
          onClick={handleExport}
          title="Export workflow as JSON"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Import workflow from JSON"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}