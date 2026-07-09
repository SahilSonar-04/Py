"use client";

import { useEffect, useRef, useState } from "react";
import { NodeToolbar, Position, type NodeProps } from "reactflow";
import { useCanvasStore } from "@/store/canvas-store";
import type { StickyNoteColor, StickyNoteData, StickyNoteFont } from "@/types/workflow";

const COLOR_MAP: Record<StickyNoteColor, string> = {
  yellow: "rgb(254, 249, 195)",
  blue: "rgb(219, 234, 254)",
  green: "rgb(220, 252, 231)",
  pink: "rgb(252, 231, 243)",
  purple: "rgb(243, 232, 255)",
  orange: "rgb(255, 237, 213)",
};

const FONT_MAP: Record<StickyNoteFont, string> = {
  sans: "sans-serif",
  serif: "serif",
  mono: "monospace",
  cursive: "cursive",
};

export function StickyNoteNode({ id, data, selected }: NodeProps<StickyNoteData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  function set<K extends keyof StickyNoteData>(key: K, value: StickyNoteData[K]) {
    updateNodeData(id, { [key]: value });
  }

  const fontSize = data.fontSize ?? 14;

  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isEditing]);

  return (
    <>
      <NodeToolbar position={Position.Right} align="center" isVisible={selected} offset={14}>
        <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          <div className="flex flex-col gap-1">
            {(Object.keys(COLOR_MAP) as StickyNoteColor[]).map((c) => (
              <button
                key={c}
                title={c[0].toUpperCase() + c.slice(1)}
                onClick={() => set("color", c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  data.color === c ? "scale-110 border-gray-800" : "border-transparent"
                }`}
                style={{ backgroundColor: COLOR_MAP[c] }}
              />
            ))}
          </div>

          <div className="mx-0.5 h-px bg-gray-200" />

          <button
            title={data.bold ? "Remove bold" : "Bold"}
            onClick={() => set("bold", !data.bold)}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors ${
              data.bold ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <span className="font-bold">B</span>
          </button>

          <div className="mx-0.5 h-px bg-gray-200" />

          <div className="flex flex-col items-center gap-0.5">
            <button
              title="Increase font size"
              disabled={fontSize >= 48}
              onClick={() => set("fontSize", Math.min(48, fontSize + 2))}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              A+
            </button>
            <span className="select-none text-[9px] leading-none text-gray-500">{fontSize}</span>
            <button
              title="Decrease font size"
              disabled={fontSize <= 12}
              onClick={() => set("fontSize", Math.max(12, fontSize - 2))}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              A−
            </button>
          </div>

          <div className="mx-0.5 h-px bg-gray-200" />

          <div className="flex flex-col gap-1">
            {(Object.keys(FONT_MAP) as StickyNoteFont[]).map((f) => (
              <button
                key={f}
                title={f[0].toUpperCase() + f.slice(1)}
                onClick={() => set("font", f)}
                style={{ fontFamily: FONT_MAP[f] }}
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] transition-colors ${
                  data.font === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Aa
              </button>
            ))}
          </div>
        </div>
      </NodeToolbar>

      <div
        className={`h-[160px] w-[200px] rounded-xl p-2.5 shadow-sm transition-shadow ${
          isEditing ? "" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          backgroundColor: COLOR_MAP[data.color],
          boxShadow: selected
            ? "0 0 0 2px var(--workflow-accent-500), 0 0 16px 2px rgba(99,102,241,0.45)"
            : undefined,
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={data.text}
            onChange={(e) => set("text", e.target.value)}
            onBlur={() => setIsEditing(false)}
            placeholder="Type a note..."
            className={`nodrag nowheel h-full w-full resize-none rounded-lg border-none bg-transparent p-3 leading-relaxed text-gray-800 outline-none transition-colors placeholder:font-normal placeholder:text-gray-400/60 ${
              data.bold ? "font-bold" : "font-normal"
            }`}
            style={{ fontFamily: FONT_MAP[data.font], fontSize }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
              }
              e.stopPropagation();
            }}
          />
        ) : (
          <div
            className={`h-full w-full select-none overflow-hidden whitespace-pre-wrap break-words rounded-lg p-3 leading-relaxed ${
              data.text ? "text-gray-800" : "text-gray-400/60"
            } ${data.bold ? "font-bold" : "font-normal"}`}
            style={{ fontFamily: FONT_MAP[data.font], fontSize }}
          >
            {data.text || "Type a note..."}
          </div>
        )}
      </div>
    </>
  );
}