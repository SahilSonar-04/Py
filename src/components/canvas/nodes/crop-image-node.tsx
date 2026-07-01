"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import {
  Play,
  Loader2,
  Upload,
  Crop,
  RotateCcw,
  MoreHorizontal,
  X,
  Coins,
} from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { ParamSlider } from "./param-slider";
import { ImageUploadFlyout } from "./image-upload-flyout";
import { InfoTooltip } from "./info-tooltip";
import { NodeOptionsMenu } from "./node-options-menu";
import { useCanvasStore } from "@/store/canvas-store";
import type { CropImageData } from "@/types/workflow";

export function CropImageNode({ id, data, selected }: NodeProps<CropImageData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const isLocked = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === id)?.draggable === false
  );
  const [uploading, setUploading] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isInputImageConnected = useCanvasStore((s) => s.isHandleConnected(id, "input_image"));
  const isXConnected = useCanvasStore((s) => s.isHandleConnected(id, "x"));
  const isYConnected = useCanvasStore((s) => s.isHandleConnected(id, "y"));
  const isWidthConnected = useCanvasStore((s) => s.isHandleConnected(id, "width"));
  const isHeightConnected = useCanvasStore((s) => s.isHandleConnected(id, "height"));

  function set<K extends keyof CropImageData>(key: K, value: CropImageData[K]) {
    updateNodeData(id, { [key]: value });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) set("inputImageUrl", json.url);
    } finally {
      setUploading(false);
      setFlyoutOpen(false);
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
        // Defensive coercion: even though the API route now always returns a
        // string, guard here too so a future regression can't crash the UI
        // by setting an object/array into `data.error`, which is rendered
        // directly as a React child below.
        const message =
          typeof json.error === "string"
            ? json.error
            : json.error
            ? JSON.stringify(json.error)
            : "Unknown error";
        set("error", message);
      }
    } catch (err) {
      set("status", "failed");
      set("error", err instanceof Error ? err.message : String(err));
    }
  }

  const isRunning = data.status === "running";
  const isSkipped = data.status === "skipped";

  return (
    <div
      className={`node-card max-w-[420px] ${isRunning ? "node-running" : ""} ${
        isSkipped ? "node-skipped" : ""
      } ${selected ? "node-locked-ring" : ""}`}
      style={{ overflow: "visible" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Crop className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {data.label || "Crop Image"}
          </span>
          {isSkipped && (
            <span className="ml-1 shrink-0 rounded-full border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              Skipped
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <InfoTooltip text="Crop an image to specified dimensions" side="bottom" />
          <button
            title="Reset all parameters"
            onClick={() => updateNodeData(id, { x: 0, y: 0, width: 100, height: 100 })}
            className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={runSingleNode}
            disabled={isRunning || !data.inputImageUrl}
            className="nodrag flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
            Run
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="nodrag flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            <NodeOptionsMenu
              nodeId={id}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              locked={isLocked}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4" style={{ overflow: "visible" }}>
        {/* Input image */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 12 }}>
            <TypedHandle type="target" position={Position.Left} id="input_image" dataType="image" />
          </div>
          <div className="pl-3">
            <div className="mb-1.5 text-xs text-gray-500">
              Input Image<span className="text-red-400">*</span>
            </div>
            <div className="relative flex items-center gap-2" style={{ overflow: "visible" }}>
              <button
                onClick={() => !isInputImageConnected && setFlyoutOpen((v) => !v)}
                disabled={isInputImageConnected}
                className={`nodrag flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-xs ${
                  isInputImageConnected
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-gray-400 hover:text-gray-700"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{data.inputImageUrl ? "Change Image" : "Upload Image"}</span>
              </button>
              <button className="nodrag flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                +
              </button>

              {flyoutOpen && (
                <ImageUploadFlyout
                  uploading={uploading}
                  onUploadFile={uploadFile}
                  onSelectAsset={(url) => set("inputImageUrl", url)}
                  onClose={() => setFlyoutOpen(false)}
                />
              )}
            </div>

            {data.inputImageUrl && (
              <div className="relative mt-2 overflow-hidden rounded-lg border border-indigo-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.inputImageUrl} alt="input" className="block w-full" />
                <div
                  className="pointer-events-none absolute border-2 border-indigo-500 bg-indigo-500/10"
                  style={{
                    left: `${data.x}%`,
                    top: `${data.y}%`,
                    width: `${data.width}%`,
                    height: `${data.height}%`,
                  }}
                />
                <button
                  onClick={() => set("inputImageUrl", "")}
                  className="nodrag absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* x/y/width/height sliders */}
        <div className="space-y-3 pl-3">
          <SliderHandle nodeId={id} id="x" />
          <ParamSlider
            label="X Position (%)"
            info="Horizontal offset of the crop box from the left edge."
            value={data.x}
            defaultValue={0}
            disabled={isXConnected}
            onChange={(v) => set("x", v)}
          />
          <SliderHandle nodeId={id} id="y" />
          <ParamSlider
            label="Y Position (%)"
            info="Vertical offset of the crop box from the top edge."
            value={data.y}
            defaultValue={0}
            disabled={isYConnected}
            onChange={(v) => set("y", v)}
          />
          <SliderHandle nodeId={id} id="width" />
          <ParamSlider
            label="Width (%)"
            info="Crop width as a percentage of the original image."
            value={data.width}
            min={1}
            defaultValue={100}
            disabled={isWidthConnected}
            onChange={(v) => set("width", v)}
          />
          <SliderHandle nodeId={id} id="height" />
          <ParamSlider
            label="Height (%)"
            info="Crop height as a percentage of the original image."
            value={data.height}
            min={1}
            defaultValue={100}
            disabled={isHeightConnected}
            onChange={(v) => set("height", v)}
          />
        </div>

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
                <img src={data.outputImageUrl} alt="cropped output" className="h-full w-full rounded object-cover" />
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  {isRunning
                    ? "Processing (30s+)..."
                    : isSkipped
                    ? "Skipped — outside this run's scope"
                    : "No output yet"}
                </div>
              )}
            </div>
            {data.error && <p className="mt-1 text-[10px] text-red-500">{data.error}</p>}

            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-gray-400">
              <Coins className="h-3 w-3" />
              ~0.005 M
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders just the absolutely-positioned typed handle dot for a slider row. */
function SliderHandle({ nodeId, id }: { nodeId: string; id: string }) {
  return (
    <div className="relative h-0" style={{ overflow: "visible" }}>
      <div className="absolute flex items-center" style={{ left: -34, top: -6 }}>
        <TypedHandle type="target" position={Position.Left} id={id} dataType="number" />
      </div>
    </div>
  );
}