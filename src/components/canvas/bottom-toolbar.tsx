"use client";

import { useState } from "react";
import { File, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useReactFlow } from "reactflow";
import { NodePicker } from "./node-picker";
import { useCanvasStore } from "@/store/canvas-store";
import type { StickyNoteData } from "@/types/workflow";

export function BottomToolbar({ historyOpen }: { historyOpen?: boolean }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addNode = useCanvasStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  function spawnPosition() {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    return {
      x: center.x - 100 + (Math.random() * 40 - 20),
      y: center.y - 80 + (Math.random() * 40 - 20),
    };
  }
  function addStickyNote() {
    const id = `sticky_note_${nanoid(8)}`;
    addNode({
      id,
      type: "sticky_note",
      position: spawnPosition(),
      data: { text: "", color: "yellow", bold: false, fontSize: 14, font: "sans" } as StickyNoteData,
    });
  }

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex items-center gap-2 transition-transform duration-300 ease-in-out"
      style={{ transform: historyOpen ? "translateX(calc(-50% - 180px))" : "translateX(-50%)" }}
    >
      {}
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 px-1 py-1 shadow-md backdrop-blur-sm md:gap-1 md:px-1.5 md:py-1.5">
        <span className="group relative">
          <button
            suppressHydrationWarning
            onClick={addStickyNote}
            title="Add Sticky Note"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <File className="h-4 w-4" />
          </button>
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Add Sticky Note
          </span>
        </span>

        <div className="mx-0.5 h-5 w-px bg-gray-200" />

        <button
          suppressHydrationWarning
          onClick={() => setPickerOpen(true)}
          title="Add node"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {pickerOpen && <NodePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}