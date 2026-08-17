"use client";

import { useState } from "react";
import { Position, type NodeProps } from "reactflow";
import {
  Play,
  Loader2,
  Bot,
  RotateCcw,
  MoreHorizontal,
  ChevronDown,
  Plus,
  Copy,
  Check,
} from "lucide-react";
import { TypedHandle } from "./typed-handle";
import { InfoTooltip } from "./info-tooltip";
import { NodeOptionsMenu } from "./node-options-menu";
import { MarkdownText } from "./markdown-text";
import { useCanvasStore } from "@/store/canvas-store";
import type { AgentData, ToolCallLogEntry } from "@/types/workflow";

const AVAILABLE_TOOLS = [
  { id: "search_web", label: "Web Search", description: "Search the web for current info" },
  { id: "knowledge_lookup", label: "Knowledge Lookup", description: "Query ingested documents" },
];

const RESPONSE_COLLAPSED_MAX_HEIGHT = 160;
const RESPONSE_READ_MORE_THRESHOLD = 300;

export function AgentNode({ id, data, selected }: NodeProps<AgentData>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addFieldAndConnect = useCanvasStore((s) => s.addFieldAndConnect);

  const isLocked = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === id)?.draggable === false
  );

  const isPromptConnected = useCanvasStore((s) =>
    s.isHandleConnected(id, "prompt")
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const [toolLogOpen, setToolLogOpen] = useState(false);

  function set<K extends keyof AgentData>(key: K, value: AgentData[K]) {
    updateNodeData(id, { [key]: value });
  }

  function toggleTool(toolId: string) {
    const current = data.enabledTools ?? [];
    const next = current.includes(toolId)
      ? current.filter((t) => t !== toolId)
      : [...current, toolId];
    set("enabledTools", next);
  }

  function resetFields() {
    updateNodeData(id, {
      prompt: "",
      enabledTools: [],
      response: undefined,
      toolCallLog: undefined,
      error: undefined,
      status: "idle",
    });
  }

  async function runSingleNode() {
    set("status", "running");
    set("error", undefined);
    try {
      const res = await fetch("/api/nodes/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt,
          enabledTools: data.enabledTools,
        }),
      });
      const json = await res.json();
      if (json.response !== undefined) {
        set("response", json.response);
        set("toolCallLog", json.toolCallLog ?? []);
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
  const showReadMoreToggle = (data.response?.length ?? 0) > RESPONSE_READ_MORE_THRESHOLD;
  const toolCalls = data.toolCallLog ?? [];

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
          <Bot className="h-3.5 w-3.5 shrink-0 text-orange-500" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {data.label || "Agent"}
          </span>
          {isSkipped && (
            <span className="ml-1 shrink-0 rounded-full border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              Skipped
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <InfoTooltip
            text="Agentic node — uses Gemini function calling to autonomously select and execute tools"
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

      {/* ── Body ── */}
      <div className="space-y-4 px-4 py-4" style={{ overflow: "visible" }}>
        {/* Prompt */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="absolute flex items-center" style={{ left: -22, top: 8 }}>
            <TypedHandle type="target" position={Position.Left} id="prompt" dataType="text" />
          </div>
          <div className="mb-1.5 flex items-center justify-between pl-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              Prompt<span className="text-red-400">*</span>
              <InfoTooltip text="The instruction for the agent. It will decide which tools to call." side="right" />
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
            placeholder="Ask the agent something..."
            rows={3}
            disabled={isPromptConnected}
            className={`nodrag nowheel ml-3 w-[calc(100%-0.75rem)] resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-workflow-accent-500 ${
              isPromptConnected ? "cursor-not-allowed opacity-50" : ""
            }`}
          />
        </div>

        {/* Tools */}
        <div className="relative" style={{ overflow: "visible" }}>
          <div className="mb-1.5 flex items-center gap-1 pl-3 text-xs text-gray-500">
            Tools
            <InfoTooltip text="Select which tools the agent can call during execution." side="right" />
          </div>
          <div className="ml-3 space-y-1.5">
            {AVAILABLE_TOOLS.map((tool) => (
              <label
                key={tool.id}
                className="nodrag flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs transition-colors hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  checked={data.enabledTools?.includes(tool.id) ?? false}
                  onChange={() => toggleTool(tool.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                <div>
                  <span className="font-medium text-gray-700">{tool.label}</span>
                  <span className="ml-1 text-gray-400">— {tool.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tool Call Log */}
        {toolCalls.length > 0 && (
          <div className="relative" style={{ overflow: "visible" }}>
            <button
              onClick={() => setToolLogOpen((v) => !v)}
              className="nodrag flex items-center gap-2 pl-3 text-xs text-gray-400 hover:text-gray-600"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${toolLogOpen ? "" : "-rotate-90"}`}
              />
              <span>Tool Calls ({toolCalls.length})</span>
            </button>
            {toolLogOpen && (
              <div className="nodrag nowheel ml-3 mt-2 max-h-[200px] space-y-2 overflow-y-auto">
                {toolCalls.map((call: ToolCallLogEntry, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="rounded bg-orange-200 px-1.5 py-0.5 text-[10px] font-mono font-medium text-orange-800">
                        {call.tool}
                      </span>
                    </div>
                    <div className="mb-1 text-gray-500">
                      <span className="font-medium">Args:</span>{" "}
                      <code className="rounded bg-white px-1 py-0.5 text-[10px]">
                        {JSON.stringify(call.args)}
                      </code>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-medium">Result:</span>{" "}
                      <span className="text-[11px]">
                        {typeof call.result === "string"
                          ? call.result.length > 150
                            ? call.result.slice(0, 150) + "..."
                            : call.result
                          : JSON.stringify(call.result)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Response ── */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="relative" style={{ overflow: "visible" }}>
            <div className="absolute flex items-center" style={{ right: -22, top: 8 }}>
              <TypedHandle type="source" position={Position.Right} id="response" dataType="text" />
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Response</span>
              <CopyButton value={data.response} />
            </div>
            <div
              className="nodrag nowheel selectable-text cursor-text select-text min-h-[84px] rounded-lg border border-gray-200 bg-gray-50 p-3"
              style={
                !responseExpanded
                  ? { maxHeight: RESPONSE_COLLAPSED_MAX_HEIGHT, overflowY: "auto" }
                  : undefined
              }
            >
              {data.response ? (
                <MarkdownText text={data.response} className="text-xs text-gray-800" />
              ) : (
                <div className="py-6 text-center text-xs text-gray-400">
                  {isRunning
                    ? "Agent is thinking..."
                    : isSkipped
                    ? "Skipped — outside this run's scope"
                    : "No output yet"}
                </div>
              )}
            </div>
            {showReadMoreToggle && (
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setResponseExpanded((v) => !v)}
                  className="nodrag text-[10px] font-medium text-workflow-accent-600 hover:underline"
                >
                  {responseExpanded ? "Read less" : "Read more"}
                </button>
              </div>
            )}
            {data.error && <p className="mt-1 text-[10px] text-red-500">{data.error}</p>}
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
