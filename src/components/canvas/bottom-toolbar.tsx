"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { NodePicker } from "./node-picker";

export function BottomToolbar() {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 px-1 py-1 shadow-sm backdrop-blur-sm md:gap-1 md:px-2 md:py-1.5">
        <button
          className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Notes"
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Add node"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {pickerOpen && <NodePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
