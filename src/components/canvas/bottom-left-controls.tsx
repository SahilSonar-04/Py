"use client";

import { useCallback, useState } from "react";
import { useReactFlow, useViewport } from "reactflow";
import {
  ChevronRight,
  ChevronLeft,
  Undo2,
  Redo2,
  Command,
  Minus,
  Plus,
  Maximize2,
  LayoutGrid,
  Move,
} from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

function ControlButton({
  onClick,
  disabled,
  active,
  children,
  label,
  shortcut,
}: {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
          active ? "bg-gray-100 text-gray-900" : ""
        }`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
        {shortcut && (
          <span className="rounded border border-white/20 bg-white/10 px-1 py-0.5 text-[10px] leading-none">
            {shortcut}
          </span>
        )}
      </span>
    </span>
  );
}

/** Layered BFS layout, shared between the toolbar button and the Shift+A keyboard shortcut. */
export function useAutoArrange() {
  const { fitView } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodesStore = useCanvasStore((s) => s.setNodes);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  return useCallback(() => {
    const incoming = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const n of nodes) incoming.set(n.id, 0);
    for (const e of edges) {
      incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
      const list = adjacency.get(e.source) ?? [];
      list.push(e.target);
      adjacency.set(e.source, list);
    }

    const levels: string[][] = [];
    const seen = new Set<string>();
    const remaining = new Map(incoming);
    let frontier = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);

    while (frontier.length > 0) {
      levels.push(frontier);
      frontier.forEach((id) => seen.add(id));
      const next: string[] = [];
      for (const id of frontier) {
        for (const target of adjacency.get(id) ?? []) {
          const left = (remaining.get(target) ?? 0) - 1;
          remaining.set(target, left);
          if (left <= 0 && !seen.has(target)) next.push(target);
        }
      }
      frontier = Array.from(new Set(next));
    }
    const placed = new Set(levels.flat());
    const leftover = nodes.map((n) => n.id).filter((id) => !placed.has(id));
    if (leftover.length > 0) levels.push(leftover);

    const COLUMN_GAP = 420;
    const ROW_GAP = 260;
    const positions = new Map<string, { x: number; y: number }>();
    levels.forEach((level, colIndex) => {
      level.forEach((id, rowIndex) => {
        positions.set(id, {
          x: colIndex * COLUMN_GAP,
          y: rowIndex * ROW_GAP - ((level.length - 1) * ROW_GAP) / 2,
        });
      });
    });

    pushHistory();
    setNodesStore(
      nodes.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n))
    );
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [nodes, edges, pushHistory, setNodesStore, fitView]);
}

export function BottomLeftControls({
  selectMode,
  onToggleSelectMode,
  onOpenShortcuts,
}: {
  selectMode: boolean;
  onToggleSelectMode: () => void;
  onOpenShortcuts: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const handleAutoArrange = useAutoArrange();

  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  if (!expanded) {
    return (
      <span className="group relative pointer-events-auto">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Expand controls
        </span>
      </span>
    );
  }

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 px-1.5 py-1.5 shadow-md backdrop-blur-sm">
      <ControlButton label="Collapse controls" onClick={() => setExpanded(false)}>
        <ChevronLeft className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Undo" shortcut="⌘Z" onClick={undo} disabled={!canUndo}>
        <Undo2 className="h-4 w-4" />
      </ControlButton>
      <ControlButton label="Redo" shortcut="⌘⇧Z" onClick={redo} disabled={!canRedo}>
        <Redo2 className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Keyboard shortcuts" onClick={onOpenShortcuts}>
        <Command className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Zoom Out" shortcut="-" onClick={() => zoomOut({ duration: 200 })}>
        <Minus className="h-4 w-4" />
      </ControlButton>

      <span className="w-11 select-none text-center text-xs font-medium tabular-nums text-gray-600">
        {Math.round(zoom * 100)}%
      </span>

      <ControlButton label="Zoom In" shortcut="+" onClick={() => zoomIn({ duration: 200 })}>
        <Plus className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Fit View" shortcut="F" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
        <Maximize2 className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Auto-arrange" shortcut="Shift+A" onClick={handleAutoArrange}>
        <LayoutGrid className="h-4 w-4" />
      </ControlButton>

      <ControlButton label="Select Mode" shortcut="S" active={selectMode} onClick={onToggleSelectMode}>
        <Move className="h-4 w-4" />
      </ControlButton>
    </div>
  );
}