"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import { Play, Loader2, Upload, Crop } from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { useCanvasStore } from "@/store/canvas-store";
import type { CropImageData } from "@/types/workflow";

export function CropImageNode({ id, data, selected }: NodeProps<CropImageData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof CropImageData>(key: K, value: CropImageData[K]) {
    updateNodeData(id, { [key]: value });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) set("inputImageUrl", json.url);
    } finally {
      setUploading(false);
    }
  }

  async function runSingleNode() {
    set("status", "running");
    try {
      const res = await fetch("/api/nodes/crop-image/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImageUrl: data.inputImageUrl,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
        }),
      });
      const json = await res.json();
      if (json.outputImageUrl) {
        set("outputImageUrl", json.outputImageUrl);
        set("status", "success");
      } else {
        set("status", "failed");
        set("error", json.error ?? "Unknown error");
      }
    } catch (err) {
      set("status", "failed");
      set("error", err instanceof Error ? err.message : String(err));
    }
  }

  const isRunning = data.status === "running";

  return (
    <div
      className={`node-card max-w-[380px] ${isRunning ? "node-running" : ""} ${
        selected ? "node-locked-ring" : ""
      }`}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Crop className="h-3.5 w-3.5" />
          </div>
          <span className="truncate text-sm font-medium text-gray-900">{data.label || "Crop Image"}</span>
        </div>
        <button
          onClick={runSingleNode}
          disabled={isRunning || !data.inputImageUrl}
          className="nodrag flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-600 transition-all hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
          <span>Run</span>
        </button>
      </div>

      <div className="space-y-4 px-4 py-4" style={{ overflow: "visible" }}>
        {/* Input image */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 12 }}>
            <TypedHandle type="target" position={Position.Left} id="input_image" dataType="image" />
          </div>
          <div className="flex items-start gap-3 pl-3">
            <span className="shrink-0 pt-2 text-xs text-gray-500">
              Input Image<span className="text-red-400">*</span>
            </span>
            <div className="flex-1">
              {data.inputImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.inputImageUrl}
                  alt="input"
                  className="mb-2 h-20 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}
              <label className="nodrag flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploading ? "Uploading..." : "Upload image"}</span>
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
          </div>
        </div>

        {/* x/y/width/height params */}
        <CropParamField id="x" label="X Position (%)" value={data.x} onChange={(v) => set("x", v)} />
        <CropParamField id="y" label="Y Position (%)" value={data.y} onChange={(v) => set("y", v)} />
        <CropParamField
          id="width"
          label="Width (%)"
          value={data.width}
          onChange={(v) => set("width", v)}
        />
        <CropParamField
          id="height"
          label="Height (%)"
          value={data.height}
          onChange={(v) => set("height", v)}
        />

        {/* Output */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative" style={{ overflow: "visible" }}>
            <div className="absolute flex items-center" style={{ right: -22, top: 8 }}>
              <TypedHandle type="source" position={Position.Right} id="output_image" dataType="image" />
            </div>
            <div className="mb-1.5 text-xs text-gray-500">Output Image</div>
            <div className="min-h-[100px] rounded-lg border border-gray-200 bg-gray-50 p-2">
              {data.outputImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.outputImageUrl}
                  alt="cropped output"
                  className="h-full w-full rounded object-cover"
                />
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  {isRunning ? "Processing (30s+)..." : "No output yet"}
                </div>
              )}
            </div>
            {data.error && <p className="mt-1 text-[10px] text-red-500">{data.error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CropParamField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative" style={{ overflow: "visible" }}>
      <div className="absolute flex items-center" style={{ left: -22, top: 20 }}>
        <TypedHandle type="target" position={Position.Left} id={id} dataType="number" />
      </div>
      <div className="flex items-center gap-3 pl-3">
        <span className="w-28 shrink-0 truncate text-xs text-gray-500">{label}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="nodrag h-9 w-full rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
        />
      </div>
    </div>
  );
}
