"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { NodePicker } from "./node-picker";
import { useCanvasStore } from "@/store/canvas-store";
import type { StickyNoteData } from "@/types/workflow";

export function BottomToolbar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);

  function addStickyNote() {
    const id = `sticky_note_${nanoid(8)}`;
    const offsetX = 480 + (nodes.length % 4) * 60;
    const offsetY = -200 + (nodes.length % 5) * 120;
    addNode({
      id,
      type: "sticky_note",
      position: { x: offsetX, y: offsetY },
      data: { text: "", color: "yellow", bold: false, fontSize: 14, font: "sans" } as StickyNoteData,
    });
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 px-1 py-1 shadow-sm backdrop-blur-sm md:gap-1 md:px-2 md:py-1.5">
        <button
          onClick={addStickyNote}
          title="Add Sticky Note"
          className="group relative rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <FileText className="h-4 w-4" />
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Add Sticky Note
          </span>
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          title="Add node"
          className="rounded p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {pickerOpen && <NodePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}