"use client";

import { Position, type NodeProps } from "reactflow";
import { FileOutput, Info, Pencil, Trash2 } from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { useCanvasStore } from "@/store/canvas-store";
import { labelForResponseSource } from "@/lib/response-label";
import type { ResponseData } from "@/types/workflow";

export function ResponseNode({ id, data, selected }: NodeProps<ResponseData>) {
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const incomingEdges = edges.filter((e) => e.target === id && e.targetHandle === "result");

  const rows = incomingEdges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const label = labelForResponseSource(sourceNode, edge.sourceHandle ?? null);
    const cached = data.slots.find((s) => s.id === edge.id);
    return { edgeId: edge.id, label, value: cached?.value };
  });

  function handleDisconnect(edgeId: string) {
    pushHistory();
    setEdges(edges.filter((e) => e.id !== edgeId));
    updateNodeData(id, { slots: data.slots.filter((s) => s.id !== edgeId) });
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
            {rows.map((row) => (
              <div key={row.edgeId} className="space-y-2 rounded-lg bg-[#F5F5F5] p-3">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900" title={row.label}>
                    {row.label}
                  </span>
                  <button
                    className="nodrag rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDisconnect(row.edgeId)}
                    className="nodrag rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500"
                    title="Remove connection"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex h-10 items-center justify-center rounded border border-gray-200 bg-white">
                  <span className="truncate px-2 text-xs text-gray-400">
                    {row.value ? String(row.value).slice(0, 60) : "No output yet"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}