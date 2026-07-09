import { z } from "zod";

export const requestFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  type: z.enum(["text_field", "image_field", "number_field"]),
  value: z.string().default(""),
});

export const rfNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["request", "crop_image", "gemini", "response", "sticky_note"]), 
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.any()),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

export const rfEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.string(), z.any()).optional(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(rfNodeSchema),
  edges: z.array(rfEdgeSchema),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(120).default("Untitled Workflow"),
  graph: workflowGraphSchema.optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: workflowGraphSchema.optional(),
  status: z.enum(["idle", "running"]).optional(),
});

export const runWorkflowSchema = z.object({
  scope: z.enum(["FULL", "PARTIAL", "SINGLE"]),
  targetNodeIds: z.array(z.string()).optional(),
});

export const cropImageTaskInputSchema = z.object({
  inputImageUrl: z
    .string()
    .min(1, "Input image is required")
    .refine(
      (val) => val.startsWith("/uploads/") || /^https?:\/\//.test(val),
      "Input image must be an uploaded file or a valid http(s) URL"
    ),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});

export const geminiTaskInputSchema = z.object({
  model: z.string(),
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});