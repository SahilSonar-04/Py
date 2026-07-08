"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Plus, Workflow as WorkflowIcon, Pencil, Trash2, Loader2, Download, Upload } from "lucide-react";
import {
  downloadWorkflowJson,
  parseWorkflowImport,
  ensureLockedNodesPresent,
  WorkflowImportError,
} from "@/lib/workflow-io";

interface WorkflowSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function ClientFormattedDate({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return <>{text ?? "—"}</>;
}

export function DashboardClient({ initialWorkflows }: { initialWorkflows: WorkflowSummary[] }) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const router = useRouter();

  async function createWorkflow() {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      const json = await res.json();
      if (json.workflow?.id) router.push(`/workflows/${json.workflow.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function createSampleWorkflow() {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows/seed-sample", { method: "POST" });
      const json = await res.json();
      if (json.workflow?.id) router.push(`/workflows/${json.workflow.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
  }

  async function confirmRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function exportWorkflow(id: string) {
    setExportingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`);
      const json = await res.json();
      if (!json.workflow) return;
      const graph = json.workflow.graph as { nodes: unknown[]; edges: unknown[] };
      downloadWorkflowJson(
        json.workflow.name,
        graph.nodes as never,
        graph.edges as never
      );
    } finally {
      setExportingId(null);
    }
  }

  async function importWorkflow(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseWorkflowImport(text);
      const nodes = ensureLockedNodesPresent(parsed.nodes);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.name ?? "Imported Workflow",
          graph: { nodes, edges: parsed.edges },
        }),
      });
      const json = await res.json();
      if (json.workflow?.id) router.push(`/workflows/${json.workflow.id}`);
      else alert("Import failed: server rejected the workflow.");
    } catch (err) {
      alert(err instanceof WorkflowImportError ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }  

  return (
    <div className="flex h-screen w-screen flex-col bg-[#fafafa]">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <WorkflowIcon className="h-5 w-5 text-workflow-accent-500" />
          <span className="text-lg font-semibold text-gray-900">Py</span>
        </div>
        <UserButton />
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Your Workflows</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={createSampleWorkflow}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Load Sample Workflow
            </button>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import
              <input
                type="file"
                accept="application/json,.json"
                hidden
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importWorkflow(file);
                  e.target.value = "";
                }}
              />
            </label>

            <button
              onClick={createWorkflow}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-workflow-accent-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-workflow-accent-600 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Workflow
            </button>
          </div>
        </div>

        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <WorkflowIcon className="mb-3 h-10 w-10 text-gray-300" />
            <p className="mb-1 text-sm font-medium text-gray-700">
              No workflows yet
            </p>
            <p className="mb-4 text-xs text-gray-400">
              Create your first workflow to start building with LLM nodes.
            </p>
            <button
              onClick={createWorkflow}
              className="rounded-lg bg-workflow-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-workflow-accent-600"
            >
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Last Edited</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {workflows.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      {renamingId === w.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => confirmRename(w.id)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && confirmRename(w.id)
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => router.push(`/workflows/${w.id}`)}
                          className="font-medium text-gray-900 hover:text-workflow-accent-600"
                        >
                          {w.name}
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          w.status === "running"
                            ? "border-blue-200 bg-blue-100 text-blue-700"
                            : "border-gray-200 bg-gray-100 text-gray-600"
                        }`}
                      >
                        {w.status === "running" ? "Running" : "Idle"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500">
                      <ClientFormattedDate iso={w.updatedAt} />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/workflows/${w.id}`)}
                          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Open
                        </button>

                        <button
                          onClick={() => {
                            setRenamingId(w.id);
                            setRenameValue(w.name);
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => exportWorkflow(w.id)}
                          disabled={exportingId === w.id}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                          title="Export as JSON"
                        >
                          {exportingId === w.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => deleteWorkflow(w.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
