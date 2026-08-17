import type { Edge, Node } from "reactflow";

export type PyNodeType = "request" | "crop_image" | "gemini" | "knowledge" | "agent" | "response" | "sticky_note";
export type StickyNoteColor = "yellow" | "blue" | "green" | "pink" | "purple" | "orange";
export type StickyNoteFont = "sans" | "serif" | "mono" | "cursive";

export type RequestFieldType = "text_field" | "image_field" | "number_field";

export interface StickyNoteData {
  text: string;
  color: StickyNoteColor;
  bold: boolean;
  fontSize: number;
  font: StickyNoteFont;
}

export interface RequestField {
  id: string;
  name: string;
  type: RequestFieldType;
  value: string;
}

export interface RequestInputsData {
  label: "Request-Inputs";
  fields: RequestField[];
  locked: true;
}

export interface CropImageData {
  label: string;
  inputImageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outputImageUrl?: string;
  status: ExecStatus;
  error?: string;
}

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface GeminiData {
  label: string;
  model: GeminiModel;
  prompt: string;
  systemPrompt: string;
  imageUrls: string[];
  videoUrl: string;
  audioUrl: string;
  fileUrl: string;
  response?: string;
  status: ExecStatus;
  error?: string;
  settingsOpen: boolean;
}

export interface KnowledgeData {
  label: string;
  sourceText: string;
  sourceName: string;
  sourceId?: string;
  query: string;
  topK: number;
  retrievedChunks?: string[];
  ingested: boolean;
  status: ExecStatus;
  error?: string;
}

export interface ToolCallLogEntry {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentData {
  label: string;
  prompt: string;
  enabledTools: string[];
  knowledgeSourceId?: string;
  response?: string;
  toolCallLog?: ToolCallLogEntry[];
  status: ExecStatus;
  error?: string;
  settingsOpen: boolean;
}

export interface ResponseSlot {
  id: string;
  label: string;
  value?: string;
  customLabel?: string;
}

export interface ResponseData {
  label: "Response";
  slots: ResponseSlot[];
  locked: true;
}

export type ExecStatus = "idle" | "pending" | "running" | "success" | "failed" | "skipped";

export type PyNodeData =
  | RequestInputsData
  | CropImageData
  | GeminiData
  | KnowledgeData
  | AgentData
  | ResponseData
  | StickyNoteData;

export type PyNode = Node<PyNodeData, PyNodeType>;
export type PyEdge = Edge;

export type HandleDataType = "text" | "image" | "video" | "audio" | "file" | "number" | "boolean" | "any";

export const NODE_OUTPUT_TYPES: Record<string, HandleDataType> = {
  "crop_image:output_image": "image",
  "gemini:response": "text",
  "knowledge:context": "text",
  "knowledge:source_id": "text",
  "agent:response": "text",
};

export const NODE_INPUT_TYPES: Record<string, HandleDataType> = {
  "crop_image:input_image": "image",
  "crop_image:x": "number",
  "crop_image:y": "number",
  "crop_image:width": "number",
  "crop_image:height": "number",
  "gemini:prompt": "text",
  "gemini:system_prompt": "text",
  "gemini:image": "image",
  "gemini:video": "video",
  "gemini:audio": "audio",
  "gemini:file": "file",
  "knowledge:query": "text",
  "agent:prompt": "text",
  "agent:knowledge_source": "text",
  "response:result": "any",
};

export interface WorkflowGraph {
  nodes: PyNode[];
  edges: PyEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type RunStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
export type RunScope = "FULL" | "PARTIAL" | "SINGLE";
export type NodeExecStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export interface NodeExecutionView {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string | null;
  status: NodeExecStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  inputs: unknown;
  output: unknown;
  error: string | null;
}

export interface WorkflowRunView {
  id: string;
  workflowId: string;
  status: RunStatus;
  scope: RunScope;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  targetNodeIds: string[] | null;
  nodeExecutions: NodeExecutionView[];
}
