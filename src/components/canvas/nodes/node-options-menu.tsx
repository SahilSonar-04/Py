"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas-store";

export function NodeOptionsMenu({
  nodeId,
  open,
  onOpenChange,
  locked,
}: {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: boolean;
}) {
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const toggleNodeLock = useCanvasStore((s) => s.toggleNodeLock);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="nodrag absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
    >
      <MenuItem
        label="Duplicate"
        onClick={() => {
          duplicateNode(nodeId, false);
          onOpenChange(false);
        }}
      />
      <MenuItem
        label="Duplicate with Edges"
        onClick={() => {
          duplicateNode(nodeId, true);
          onOpenChange(false);
        }}
      />
      <MenuItem
        label={locked ? "Unlock" : "Lock"}
        onClick={() => {
          toggleNodeLock(nodeId);
          onOpenChange(false);
        }}
      />
      <MenuItem
        label="Delete"
        danger
        onClick={() => {
          removeNode(nodeId);
          onOpenChange(false);
        }}
      />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-sm text-gray-800 transition-colors ${
        danger ? "hover:bg-red-50 hover:text-red-500" : "hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}