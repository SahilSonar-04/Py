"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import { FileOutput, Info, Pencil, Trash2, Check, X, Copy } from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { MarkdownText } from "./markdown-text";
import { useCanvasStore } from "@/store/canvas-store";
import { labelForResponseSource } from "@/lib/response-label";
import type { ResponseData } from "@/types/workflow";

const VALUE_COLLAPSED_MAX_HEIGHT = 160;
const VALUE_READ_MORE_THRESHOLD = 300;

export function ResponseNode({ id, data, selected }: NodeProps<ResponseData>) {
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const incomingEdges = edges.filter((e) => e.target === id && e.targetHandle === "result");

  const rows = incomingEdges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const defaultLabel = labelForResponseSource(sourceNode, edge.sourceHandle ?? null);
    const cached = data.slots.find((s) => s.id === edge.id);
    const displayLabel = cached?.customLabel?.trim() ? cached.customLabel : defaultLabel;
    return { edgeId: edge.id, defaultLabel, displayLabel, value: cached?.value };
  });

  function handleDisconnect(edgeId: string) {
    pushHistory();
    setEdges(edges.filter((e) => e.id !== edgeId));
    updateNodeData(id, { slots: data.slots.filter((s) => s.id !== edgeId) });
  }

  function startEditing(edgeId: string, currentLabel: string) {
    setEditingEdgeId(edgeId);
    setEditValue(currentLabel);
  }

  function cancelEditing() {
    setEditingEdgeId(null);
    setEditValue("");
  }

  function commitEditing(edgeId: string, defaultLabel: string) {
    const trimmed = editValue.trim();
    pushHistory();

    const existingIndex = data.slots.findIndex((s) => s.id === edgeId);
    const nextSlots =
      existingIndex >= 0
        ? data.slots.map((s, i) => (i === existingIndex ? { ...s, customLabel: trimmed } : s))
        : [...data.slots, { id: edgeId, label: defaultLabel, customLabel: trimmed }];

    updateNodeData(id, { slots: nextSlots });
    setEditingEdgeId(null);
    setEditValue("");
  }

  return (
    <div
      className={`node-card ${selected ? "node-locked-ring" : ""}`}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-workflow-accent-500/10 text-workflow-accent-500">
          <FileOutput className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-gray-900">Response</span>
        <span className="group/tip relative">
          <Info className="h-3.5 w-3.5 cursor-default text-gray-400" />
          <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-700 shadow-lg group-hover/tip:block">
            Connect node outputs here to define what your workflow returns.
          </span>
        </span>
      </div>

      <div className="space-y-3 p-4" style={{ overflow: "visible" }}>
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -21, top: "50%" }}>
            <TypedHandle type="target" position={Position.Left} id="result" dataType="any" />
          </div>
          <span className="pl-3 text-xs text-gray-500">result</span>
        </div>

        <div className="border-t border-gray-100" />

        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">No output added yet</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isEditing = editingEdgeId === row.edgeId;
              return (
                <div key={row.edgeId} className="space-y-2 rounded-lg bg-[#F5F5F5] p-3">
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditing(row.edgeId, row.defaultLabel);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="nodrag min-w-0 flex-1 rounded border border-workflow-accent-400 bg-white px-1.5 py-0.5 text-sm text-gray-900 outline-none"
                        />
                        <button
                          onClick={() => commitEditing(row.edgeId, row.defaultLabel)}
                          className="nodrag rounded p-1 text-gray-400 hover:bg-green-100 hover:text-green-600"
                          title="Save name"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="nodrag rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="min-w-0 flex-1 truncate text-sm text-gray-900"
                          title={row.displayLabel}
                        >
                          {row.displayLabel}
                        </span>
                        <CopyButton value={row.value} />
                        <button
                          onClick={() => startEditing(row.edgeId, row.displayLabel)}
                          className="nodrag rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDisconnect(row.edgeId)}
                          className="nodrag rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500"
                          title="Remove connection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  <ResponseValueBox value={row.value} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ResponseValueBox({ value }: { value?: string }) {
  const [expanded, setExpanded] = useState(false);
  const showReadMoreToggle = (value?.length ?? 0) > VALUE_READ_MORE_THRESHOLD;

  return (
    <>
      <div
        className="nodrag nowheel selectable-text cursor-text select-text rounded border border-gray-200 bg-white px-2 py-2"
        style={
          !expanded
            ? { maxHeight: VALUE_COLLAPSED_MAX_HEIGHT, overflowY: "auto" }
            : undefined
        }
      >
        {value ? (
          <MarkdownText text={String(value)} className="text-xs text-gray-700" />
        ) : (
          <span className="block text-xs text-gray-700">No output yet</span>
        )}
      </div>
      {showReadMoreToggle && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="nodrag text-[10px] font-medium text-workflow-accent-600 hover:underline"
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        </div>
      )}
    </>
  );
}

function CopyButton({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!value}
      title={copied ? "Copied!" : "Copy to clipboard"}
      className={`nodrag rounded p-1 transition-colors ${
        copied ? "text-green-600" : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}