import type { NodeTypes } from "reactflow";
import { RequestInputsNode } from "./nodes/request-inputs-node";
import { CropImageNode } from "./nodes/crop-image-node";
import { GeminiNode } from "./nodes/gemini-node";
import { KnowledgeNode } from "./nodes/knowledge-node";
import { AgentNode } from "./nodes/agent-node";
import { ResponseNode } from "./nodes/response-node";
import { StickyNoteNode } from "./nodes/sticky-note-node";

export const nodeTypes: NodeTypes = {
  request: RequestInputsNode,
  crop_image: CropImageNode,
  gemini: GeminiNode,
  knowledge: KnowledgeNode,
  agent: AgentNode,
  response: ResponseNode,
  sticky_note: StickyNoteNode,
};
