"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import { Plus, GripVertical, Trash2, Pencil, Info, Upload, Copy, Type, Image as ImageIcon, Hash } from "lucide-react";
import { nanoid } from "nanoid";
import { TypedHandle } from "./typed-handle";
import { useCanvasStore } from "@/store/canvas-store";
import type { RequestInputsData, RequestFieldType } from "@/types/workflow";

export function RequestInputsNode({ id, data, selected }: NodeProps<RequestInputsData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const removeRequestField = useCanvasStore((s) => s.removeRequestField);
  const [pickerOpen, setPickerOpen] = useState(false);

  function addField(type: RequestFieldType) {
    const count = data.fields.filter((f) => f.type === type).length;
    const baseName =
      type === "text_field" ? "text_field" : type === "image_field" ? "image_field" : "number_field";
    const name = count === 0 ? baseName : `${baseName}_${count + 1}`;
    const newField = { id: `field_${nanoid(8)}`, name, type, value: type === "number_field" ? "0" : "" };
    updateNodeData(id, { fields: [...data.fields, newField] });
    setPickerOpen(false);
  }

  function duplicateField(fieldId: string) {
    const field = data.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const newField = { ...field, id: `field_${nanoid(8)}`, name: `${field.name}_copy` };
    updateNodeData(id, { fields: [...data.fields, newField] });
  }

  function renameField(fieldId: string, name: string) {
    updateNodeData(id, {
      fields: data.fields.map((f) => (f.id === fieldId ? { ...f, name } : f)),
    });
  }

  function setFieldValue(fieldId: string, value: string) {
    updateNodeData(id, {
      fields: data.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
    });
  }

  return (
    <div
      className={`node-card ${selected ? "node-locked-ring" : ""}`}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900">Request-Inputs</span>
          <span className="group/tip relative">
            <Info className="h-3.5 w-3.5 cursor-default text-gray-400" />
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-700 shadow-lg group-hover/tip:block">
              Define the input fields for your workflow. These become the request
              parameters when running.
            </span>
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="nodrag flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
          </button>
          {pickerOpen && (
            <div className="nodrag absolute right-0 top-9 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => addField("text_field")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <Type className="h-3.5 w-3.5 text-gray-400" /> Text field
              </button>
              <button
                onClick={() => addField("number_field")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <Hash className="h-3.5 w-3.5 text-gray-400" /> Number field
              </button>
              <button
                onClick={() => addField("image_field")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <ImageIcon className="h-3.5 w-3.5 text-gray-400" /> Image field
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4" style={{ overflow: "visible" }}>
        {data.fields.length === 0 && (
          <p className="text-xs text-gray-400">
            No fields yet. Click + to add a field, or use &ldquo;Add to
            Request&rdquo; on any node input.
          </p>
        )}
        {data.fields.map((field) => (
          <div key={field.id} className="relative" style={{ overflow: "visible" }}>
            <div className="mb-2 flex w-full min-w-0 items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-400" />
              <FieldLabel
                value={field.name}
                onChange={(v) => renameField(field.id, v)}
              />
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => duplicateField(field.id)}
                  className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeRequestField(field.id)}
                  className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {field.type === "text_field" ? (
              <textarea
                value={field.value}
                onChange={(e) => setFieldValue(field.id, e.target.value)}
                placeholder="Enter text..."
                rows={3}
                className="nodrag nowheel w-full resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
              />
            ) : field.type === "number_field" ? (
              <input
                type="number"
                value={field.value}
                onChange={(e) => setFieldValue(field.id, e.target.value)}
                className="nodrag w-full rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
              />
            ) : (
              <ImageFieldUpload value={field.value} onChange={(v) => setFieldValue(field.id, v)} />
            )}

            {}
            <div
              className="pointer-events-none absolute flex items-center"
              style={{ right: -21, top: "50%", transform: "translateY(-50%)" }}
            >
              <TypedHandle
                type="source"
                position={Position.Right}
                id={field.id}
                dataType={
                  field.type === "image_field"
                    ? "image"
                    : field.type === "number_field"
                    ? "number"
                    : "text"
                }
                style={{ pointerEvents: "auto" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        className="nodrag min-w-0 flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft || value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="group/label flex min-w-0 flex-1 cursor-text items-center gap-1 text-xs font-medium text-gray-900 hover:text-workflow-accent-600"
    >
      <span className="truncate" title={value}>
        {value}
      </span>
      <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/label:opacity-100" />
    </span>
  );
}

function ImageFieldUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) onChange(json.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="uploaded preview"
          className="h-24 w-full rounded-lg border border-gray-200 object-cover"
        />
      ) : null}
      <label className="nodrag flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700">
        <Upload className="h-3.5 w-3.5" />
        <span>{uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}</span>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>
    </div>
  );
}