import type { Edge, Node } from "reactflow";

// ---------- Node type identifiers ----------
export type PyNodeType = "request" | "crop_image" | "gemini" | "response" | "sticky_note";
export type StickyNoteColor = "yellow" | "blue" | "green" | "pink" | "purple" | "orange";
export type StickyNoteFont = "sans" | "serif" | "mono" | "cursive";

// ---------- Request-Inputs node ----------
export type RequestFieldType = "text_field" | "image_field" | "number_field";

export interface StickyNoteData {
  text: string;
  color: StickyNoteColor;
  bold: boolean;
  fontSize: number; // px, clamp 12-48
  font: StickyNoteFont;
}

export interface RequestField {
  id: string;
  name: string;
  type: RequestFieldType;
  value: string; // text content OR uploaded image URL OR stringified number
}

export interface RequestInputsData {
  label: "Request-Inputs";
  fields: RequestField[];
  locked: true;
}

// ---------- Crop Image node ----------
export interface CropImageData {
  label: string;
  inputImageUrl: string; // manual value if not connected
  x: number; // 0-100
  y: number; // 0-100
  width: number; // 0-100
  height: number; // 0-100
  outputImageUrl?: string;
  status: ExecStatus;
  error?: string;
}

// ---------- Gemini node ----------
export const GEMINI_MODELS = [
  "gemini-3.1-pro",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
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

// ---------- Response node ----------
export interface ResponseSlot {
  id: string;
  label: string;
  value?: string;
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
  | ResponseData
  | StickyNoteData;

export type PyNode = Node<PyNodeData, PyNodeType>;
export type PyEdge = Edge;

// ---------- Handle data-type for connection validation ----------
export type HandleDataType = "text" | "image" | "video" | "audio" | "file" | "number" | "boolean" | "any";

// Map of nodeType -> handleId -> data type, used for type-safe connection validation
export const NODE_OUTPUT_TYPES: Record<string, HandleDataType> = {
  // request field outputs are resolved dynamically (per field) in validation logic
  "crop_image:output_image": "image",
  "gemini:response": "text",
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
  "response:result": "any",
};

// ---------- Workflow graph persisted shape ----------
export interface WorkflowGraph {
  nodes: PyNode[];
  edges: PyEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// ---------- Run / history types (mirrors Prisma enums for client use) ----------
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