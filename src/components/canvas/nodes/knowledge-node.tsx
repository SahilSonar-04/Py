"use client";

import { useRef, useState } from "react";
import { Position, type NodeProps } from "reactflow";
import {
  Play,
  Loader2,
  BookOpen,
  RotateCcw,
  MoreHorizontal,
  Check,
  Database,
  Plus,
  Upload,
  File,
  X,
} from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { InfoTooltip } from "./info-tooltip";
import { NodeOptionsMenu } from "./node-options-menu";
import { useCanvasStore } from "@/store/canvas-store";
import type { KnowledgeData } from "@/types/workflow";

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.html,.log";

export function KnowledgeNode({ id, data, selected }: NodeProps<KnowledgeData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addFieldAndConnect = useCanvasStore((s) => s.addFieldAndConnect);
  const workflowId = useCanvasStore((s) => s.workflowId);

  const isLocked = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === id)?.draggable === false
  );

  const isQueryConnected = useCanvasStore((s) =>
    s.isHandleConnected(id, "query")
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ingesting, setIngesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function set<K extends keyof KnowledgeData>(key: K, value: KnowledgeData[K]) {
    updateNodeData(id, { [key]: value });
  }

  function resetFields() {
    updateNodeData(id, {
      sourceText: "",
      sourceName: "",
      sourceId: undefined,
      query: "",
      topK: 4,
      retrievedChunks: undefined,
      ingested: false,
      error: undefined,
      status: "idle",
    });
    setUploadedFileName(null);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    set("error", undefined);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isTextFile = ["txt", "md", "csv", "json", "xml", "html", "log"].includes(ext);

    try {
      if (isTextFile) {
        // Read text files client-side — no server round-trip needed
        const text = await file.text();
        if (!text.trim()) {
          set("error", "File is empty");
          return;
        }
        set("sourceText", text);
        setUploadedFileName(file.name);
        if (!data.sourceName) {
          set("sourceName", file.name.replace(/\.[^.]+$/, ""));
        }
      } else {
        // PDF and others — server-side extraction
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/nodes/knowledge/upload", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();

        if (json.text) {
          set("sourceText", json.text);
          setUploadedFileName(json.fileName || file.name);
          if (!data.sourceName) {
            set("sourceName", (json.fileName || file.name).replace(/\.[^.]+$/, ""));
          }
        } else {
          set("error", json.error || "Failed to extract text from file");
        }
      }
    } catch (err) {
      set("error", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      // Reset the input so re-uploading the same file works
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleIngest() {
    if (!data.sourceText.trim() || !workflowId) return;
    setIngesting(true);
    set("error", undefined);

    try {
      const res = await fetch("/api/nodes/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.sourceText,
          sourceName: data.sourceName || "Untitled Source",
          workflowId,
          nodeId: id,
        }),
      });
      const json = await res.json();
      if (json.sourceId) {
        set("sourceId", json.sourceId);
        set("ingested", true);
      } else {
        const message =
          typeof json.error === "string"
            ? json.error
            : json.error
            ? JSON.stringify(json.error)
            : "Ingest failed";
        set("error", message);
      }
    } catch (err) {
      set("error", err instanceof Error ? err.message : String(err));
    } finally {
      setIngesting(false);
    }
  }

  async function runSingleNode() {
    if (!data.sourceId) {
      set("error", "Ingest source text first");
      return;
    }
    set("status", "running");
    set("error", undefined);

    try {
      const res = await fetch("/api/nodes/knowledge/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: data.sourceId,
          query: data.query,
          topK: data.topK ?? 4,
        }),
      });
      const json = await res.json();
      if (json.chunks) {
        set("retrievedChunks", json.chunks);
        set("status", "success");
      } else {
        set("status", "failed");
        const message =
          typeof json.error === "string"
            ? json.error
            : json.error
            ? JSON.stringify(json.error)
            : "Retrieval failed";
        set("error", message);
      }
    } catch (err) {
      set("status", "failed");
      set("error", err instanceof Error ? err.message : String(err));
    }
  }

  const isRunning = data.status === "running";
  const isSkipped = data.status === "skipped";
  const charCount = data.sourceText?.length ?? 0;

  return (
    <div
      className={`node-card max-w-[380px] ${isRunning ? "node-running" : ""} ${
        isSkipped ? "node-skipped" : ""
      } ${selected ? "node-locked-ring" : ""}`}
      style={{ overflow: "visible" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-purple-500" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {data.label || "Knowledge"}
          </span>
          {data.ingested && (
            <span className="ml-1 shrink-0 rounded-full border border-green-300 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
              <Check className="mr-0.5 inline h-2.5 w-2.5" />
              Ingested
            </span>
          )}
          {isSkipped && (
            <span className="ml-1 shrink-0 rounded-full border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              Skipped
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <InfoTooltip
            text="RAG node — upload a document or paste text, ingest into pgvector, retrieve relevant chunks"
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
            disabled={isRunning || !data.sourceId || !data.query}
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

      {/* ── Body ── */}
      <div className="space-y-4 px-4 py-4" style={{ overflow: "visible" }}>
        {/* Source Name */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="pl-3">
            <div className="mb-1.5 text-xs text-gray-500">Source Name</div>
            <input
              value={data.sourceName}
              onChange={(e) => set("sourceName", e.target.value)}
              placeholder="e.g. Product Manual"
              className="nodrag ml-0 w-full rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
            />
          </div>
        </div>

        {/* Document Upload + Source Text */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="mb-1.5 flex items-center justify-between pl-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Source Text<span className="text-red-400">*</span>
              <InfoTooltip text="Upload a document (.pdf, .doc, .docx, .md, .txt) or paste text directly." side="right" />
            </span>
            {charCount > 0 && (
              <span className="text-[10px] text-gray-400">
                {charCount.toLocaleString()} chars
              </span>
            )}
          </div>

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="nodrag ml-3 mb-2 flex w-[calc(100%-0.75rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Processing..." : "Upload Document"}
          </button>

          {/* Uploaded file indicator */}
          {uploadedFileName && (
            <div className="ml-3 mb-2 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs text-purple-700">
              <File className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{uploadedFileName}</span>
              <button
                type="button"
                onClick={() => {
                  setUploadedFileName(null);
                  set("sourceText", "");
                }}
                className="nodrag ml-auto shrink-0 rounded p-0.5 hover:bg-purple-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Textarea for paste / preview */}
          <textarea
            value={data.sourceText}
            onChange={(e) => set("sourceText", e.target.value)}
            placeholder="Or paste your document text here..."
            rows={uploadedFileName ? 2 : 4}
            className="nodrag nowheel ml-3 w-[calc(100%-0.75rem)] resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
          />

          {/* Ingest button */}
          <button
            onClick={handleIngest}
            disabled={ingesting || !data.sourceText.trim()}
            className="nodrag ml-3 mt-2 flex w-[calc(100%-0.75rem)] items-center justify-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ingesting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Database className="h-3 w-3" />
            )}
            {ingesting ? "Ingesting..." : data.ingested ? "Re-ingest" : "Ingest into pgvector"}
          </button>
        </div>

        {/* Query */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 8 }}>
            <TypedHandle type="target" position={Position.Left} id="query" dataType="text" />
          </div>
          <div className="mb-1.5 flex items-center justify-between pl-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Query
              <InfoTooltip text="The search query used to find relevant chunks. Can be wired from another node." side="right" />
            </span>
            {!isQueryConnected && (
              <button
                type="button"
                title="Add to Request"
                onClick={() => addFieldAndConnect(id, "query", "text", "query")}
                className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <input
            value={data.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Enter search query..."
            disabled={isQueryConnected}
            className={`nodrag ml-3 w-[calc(100%-0.75rem)] rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 ${
              isQueryConnected ? "cursor-not-allowed opacity-50" : ""
            }`}
          />
        </div>

        {/* Top K */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="pl-3">
            <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
              Top K
              <InfoTooltip text="Number of most relevant chunks to retrieve (1-10)." side="right" />
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={data.topK}
              onChange={(e) => set("topK", Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
              className="nodrag w-20 rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-workflow-accent-500"
            />
          </div>
        </div>

        {/* ── Output: Retrieved Chunks ── */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative" style={{ overflow: "visible" }}>
            <div className="absolute flex items-center" style={{ right: -22, top: 8 }}>
              <TypedHandle type="source" position={Position.Right} id="context" dataType="text" />
            </div>
            <div className="mb-1.5 text-xs text-gray-500">Retrieved Context</div>
            <div className="nodrag nowheel max-h-[200px] min-h-[60px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
              {data.retrievedChunks && data.retrievedChunks.length > 0 ? (
                <div className="space-y-2">
                  {data.retrievedChunks.map((chunk, idx) => (
                    <div key={idx} className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">
                      <span className="mb-1 block text-[10px] font-medium text-purple-500">
                        Chunk {idx + 1}
                      </span>
                      {chunk.length > 200 ? chunk.slice(0, 200) + "..." : chunk}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-gray-400">
                  {isRunning
                    ? "Retrieving..."
                    : isSkipped
                    ? "Skipped — outside this run's scope"
                    : "No chunks retrieved yet"}
                </div>
              )}
            </div>
            {data.error && <p className="mt-1 text-[10px] text-red-500">{data.error}</p>}
          </div>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative" style={{ overflow: "visible" }}>
            <div className="absolute flex items-center" style={{ right: -22, top: 8 }}>
              <TypedHandle type="source" position={Position.Right} id="source_id" dataType="text" />
            </div>
            <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
              Source ID
              <InfoTooltip
                text="Connect this to an Agent node's Knowledge Source input to enable its Knowledge Lookup tool."
                side="right"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {data.sourceId ? data.sourceId : "Ingest source text to generate an ID"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
