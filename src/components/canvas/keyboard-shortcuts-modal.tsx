"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-1.5 text-[11px] font-medium text-gray-600">
      {children}
    </span>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <Key key={i}>{k}</Key>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-gray-900">{title}</h4>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h3>
            <p className="mt-1 text-sm text-gray-400">
              Quickly navigate and create with these shortcuts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Section title="General">
            <ShortcutRow label="Undo" keys={["⌘", "Z"]} />
            <ShortcutRow label="Redo" keys={["⌘", "Shift", "Z"]} />
            <ShortcutRow label="Select all" keys={["⌘", "A"]} />
            <ShortcutRow label="Deselect all" keys={["Esc"]} />
            <ShortcutRow label="Pan canvas" keys={["Space", "Drag"]} />
            <ShortcutRow label="Zoom in" keys={["+"]} />
            <ShortcutRow label="Zoom out" keys={["-"]} />
            <ShortcutRow label="Fit view" keys={["F"]} />
            <ShortcutRow label="Toggle select mode" keys={["S"]} />
            <ShortcutRow label="Auto-arrange" keys={["Shift", "A"]} />
          </Section>

          <div className="my-4 h-px bg-gray-100" />

          <Section title="Node Operations">
            <ShortcutRow label="Copy" keys={["⌘", "C"]} />
            <ShortcutRow label="Paste" keys={["⌘", "V"]} />
            <ShortcutRow label="Duplicate" keys={["⌘", "D"]} />
            <ShortcutRow label="Duplicate with Edges" keys={["⌘", "Shift", "D"]} />
            <ShortcutRow label="Delete" keys={["Delete"]} />
          </Section>
        </div>
      </div>
    </div>,
    document.body
  );
}