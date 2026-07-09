"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import {
  Play,
  Loader2,
  ChevronDown,
  Upload,
  X,
  RotateCcw,
  MoreHorizontal,
  Coins,
  Plus,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { InfoTooltip } from "./info-tooltip";
import { NodeOptionsMenu } from "./node-options-menu";
import { MarkdownText } from "./markdown-text";
import { useCanvasStore } from "@/store/canvas-store";
import { GEMINI_MODELS, type GeminiData } from "@/types/workflow";

export function GeminiNode({ id, data, selected }: NodeProps<GeminiData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addFieldAndConnect = useCanvasStore((s) => s.addFieldAndConnect);

  const isLocked = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === id)?.draggable === false
  );

  const isPromptConnected = useCanvasStore((s) =>
    s.isHandleConnected(id, "prompt")
  );
  const isSystemPromptConnected = useCanvasStore((s) =>
    s.isHandleConnected(id, "system_prompt")
  );
  const isImageConnected = useCanvasStore((s) =>
    s.isHandleConnected(id, "image")
  );

  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function set<K extends keyof GeminiData>(key: K, value: GeminiData[K]) {
    updateNodeData(id, { [key]: value });
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) set("imageUrls", [...data.imageUrls, json.url]);
    } finally {
      setUploading(false);
    }
  }

  function resetFields() {
    updateNodeData(id, {
      prompt: "",
      systemPrompt: "",
      imageUrls: [],
      videoUrl: "",
      audioUrl: "",
      fileUrl: "",
      response: undefined,
      error: undefined,
      status: "idle",
    });
  }

  async function runSingleNode() {
    set("status", "running");
    try {
      const res = await fetch("/api/nodes/gemini/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: data.model,
          prompt: data.prompt,
          systemPrompt: data.systemPrompt,
          imageUrls: data.imageUrls,
        }),
      });
      const json = await res.json();
      if (json.response !== undefined) {
        set("response", json.response);
        set("status", "success");
      } else {
        set("status", "failed");
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
      className={`node-card max-w-[380px] ${isRunning ? "node-running" : ""} ${
        isSkipped ? "node-skipped" : ""
      } ${selected ? "node-locked-ring" : ""}`}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <select
            value={data.model}
            onChange={(e) => set("model", e.target.value as GeminiData["model"])}
            className="nodrag truncate bg-transparent text-sm font-semibold text-gray-900 outline-none"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m === "gemini-2.5-flash" ? "Gemini 2.5 Flash" : m === "gemini-2.5-pro" ? "Gemini 2.5 Pro" : m}
              </option>
            ))}
          </select>
          {isSkipped && (
            <span className="ml-1 shrink-0 rounded-full border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              Skipped
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <InfoTooltip
            text="Generate text with Gemini - supports vision, video, and audio inputs"
            side="bottom"
          />
          <button
            title="Reset fields"
            onClick={resetFields}
            className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={runSingleNode}
            disabled={isRunning || !data.prompt}
            className="nodrag flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
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
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 8 }}>
            <TypedHandle type="target" position={Position.Left} id="prompt" dataType="text" />
          </div>
          <div className="mb-1.5 flex items-center justify-between pl-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Prompt<span className="text-red-400">*</span>
              <InfoTooltip text="The main instruction sent to the model." side="right" />
            </span>
            {!isPromptConnected && (
              <button
                type="button"
                title="Add to Request"
                onClick={() => addFieldAndConnect(id, "prompt", "text", "prompt")}
                className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <textarea
            value={data.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            placeholder="Enter your prompt..."
            rows={3}
            disabled={isPromptConnected}
            className={`nodrag nowheel ml-3 w-[calc(100%-0.75rem)] resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 ${
              isPromptConnected ? "cursor-not-allowed opacity-50" : ""
            }`}
          />
        </div>

        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 14 }}>
            <TypedHandle type="target" position={Position.Left} id="system_prompt" dataType="text" />
          </div>
          <div className="mb-1.5 flex items-center justify-between pl-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              System Prompt
              <InfoTooltip text="Sets the model's persona / behavior for the whole conversation." side="right" />
            </span>
            {!isSystemPromptConnected && (
              <button
                type="button"
                title="Add to Request"
                onClick={() => addFieldAndConnect(id, "system_prompt", "text", "system_prompt")}
                className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <textarea
            value={data.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={3}
            disabled={isSystemPromptConnected}
            className={`nodrag nowheel ml-3 w-[calc(100%-0.75rem)] resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 ${
              isSystemPromptConnected ? "cursor-not-allowed opacity-50" : ""
            }`}
          />
        </div>

        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 12 }}>
            <TypedHandle type="target" position={Position.Left} id="image" dataType="image" />
          </div>
          <div className="pl-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Image (Vision)</span>
              {!isImageConnected && (
                <button
                  type="button"
                  title="Add to Request"
                  onClick={() => addFieldAndConnect(id, "image", "image", "image")}
                  className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {data.imageUrls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {data.imageUrls.map((url, idx) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-12 w-12 rounded border border-gray-200 object-cover" />
                    <button
                      onClick={() =>
                        set(
                          "imageUrls",
                          data.imageUrls.filter((_, i) => i !== idx)
                        )
                      }
                      className="nodrag absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="nodrag flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700">
              <Upload className="h-3.5 w-3.5" />
              <span>{uploading ? "Uploading..." : "Upload Image"}</span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </label>

            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600">
              <Info className="h-3 w-3" />
              Upload requirements
            </p>
          </div>
        </div>

        <UploadStyleUrlField id="video" label="Video" dataType="video" value={data.videoUrl} onChange={(v) => set("videoUrl", v)} />
        <UploadStyleUrlField id="audio" label="Audio" dataType="audio" value={data.audioUrl} onChange={(v) => set("audioUrl", v)} />
        <UploadStyleUrlField id="file" label="File" dataType="file" value={data.fileUrl} onChange={(v) => set("fileUrl", v)} />

        <div>
          <button
            onClick={() => set("settingsOpen", !data.settingsOpen)}
            className="nodrag flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${data.settingsOpen ? "" : "-rotate-90"}`}
            />
            <span>Settings</span>
          </button>
          {data.settingsOpen && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              Temperature, max tokens, and top-p controls go here.
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative" style={{ overflow: "visible" }}>
            <div className="absolute flex items-center" style={{ right: -22, top: 8 }}>
              <TypedHandle type="source" position={Position.Right} id="response" dataType="text" />
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Response</span>
              <CopyButton value={data.response} />
            </div>
            <div className="nodrag nowheel selectable-text cursor-text select-text min-h-[84px] rounded-lg border border-gray-200 bg-gray-50 p-3">
              {data.response ? (
                <MarkdownText text={data.response} className="text-xs text-gray-800" />
              ) : (
                <div className="py-6 text-center text-xs text-gray-400">
                  {isRunning
                    ? "Generating..."
                    : isSkipped
                    ? "Skipped — outside this run's scope"
                    : "No output yet"}
                </div>
              )}
            </div>
            {data.error && <p className="mt-1 text-[10px] text-red-500">{data.error}</p>}

            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-gray-400">
              <Coins className="h-3 w-3" />
              ~0.0001 M
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!value}
      title={copied ? "Copied!" : "Copy to clipboard"}
      className={`nodrag rounded p-1 transition-colors ${
        copied ? "text-green-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function UploadStyleUrlField({
  id,
  label,
  dataType,
  value,
  onChange,
}: {
  id: string;
  label: string;
  dataType: "video" | "audio" | "file";
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    onChange(draft.trim());
    setEditing(false);
  }

  return (
    <div className="relative" style={{ overflow: "visible" }}>
      <div className="absolute flex items-center" style={{ left: -22, top: 8 }}>
        <TypedHandle type="target" position={Position.Left} id={id} dataType={dataType} />
      </div>
      <div className="pl-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-gray-500">{label}</span>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="nodrag flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{value ? `Change ${label}` : `Upload ${label}`}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`${label} URL...`}
              className="nodrag h-9 flex-1 rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button
              type="button"
              onClick={commit}
              className="nodrag rounded-lg bg-workflow-accent-500 px-2.5 py-2 text-xs font-medium text-white hover:bg-workflow-accent-600"
            >
              Save
            </button>
          </div>
        )}

        {value && !editing && (
          <p className="mt-1 truncate text-[10px] text-gray-400" title={value}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}