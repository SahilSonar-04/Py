import { nanoid } from "nanoid";
import type {
  CropImageData,
  GeminiData,
  PyEdge,
  PyNode,
  RequestInputsData,
  ResponseData,
  WorkflowGraph,
} from "@/types/workflow";

export function blankWorkflowGraph(): WorkflowGraph {
  const requestNode: PyNode = {
    id: "request-inputs",
    type: "request",
    position: { x: 0, y: 0 },
    data: {
      label: "Request-Inputs",
      locked: true,
      fields: [],
    } satisfies RequestInputsData,
  };

  const responseNode: PyNode = {
    id: "response",
    type: "response",
    position: { x: 900, y: 0 },
    data: {
      label: "Response",
      locked: true,
      slots: [],
    } satisfies ResponseData,
  };

  return { nodes: [requestNode, responseNode], edges: [] };
}

export function sampleWorkflowGraph(): WorkflowGraph {
  const requestId = "request-inputs";
  const crop1Id = "crop-image-1";
  const crop2Id = "crop-image-2";
  const gemini1Id = "gemini-1";
  const gemini2Id = "gemini-2";
  const gemini3Id = "gemini-3-final";
  const responseId = "response";

  const textFieldId = `field_${nanoid(8)}`;
  const imageFieldId = `field_${nanoid(8)}`;

  const requestNode: PyNode = {
    id: requestId,
    type: "request",
    position: { x: 0, y: 200 },
    data: {
      label: "Request-Inputs",
      locked: true,
      fields: [
        {
          id: textFieldId,
          name: "text_field",
          type: "text_field",
          value:
            "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
        },
        {
          id: imageFieldId,
          name: "image_field",
          type: "image_field",
          value: "",
        },
      ],
    } satisfies RequestInputsData,
  };

  const crop1: PyNode = {
    id: crop1Id,
    type: "crop_image",
    position: { x: 480, y: 0 },
    data: {
      label: "Crop Image #1 (tight product crop)",
      inputImageUrl: "",
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      status: "idle",
    } satisfies CropImageData,
  };

  const crop2: PyNode = {
    id: crop2Id,
    type: "crop_image",
    position: { x: 480, y: 460 },
    data: {
      label: "Crop Image #2 (wide banner crop)",
      inputImageUrl: "",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      status: "idle",
    } satisfies CropImageData,
  };

  const gemini1: PyNode = {
    id: gemini1Id,
    type: "gemini",
    position: { x: 480, y: -460 },
    data: {
      label: "Gemini 2.5 Flash #1",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt:
        "You are a marketing copywriter. Write a one-paragraph product description.",
      imageUrls: [],
      videoUrl: "",
      audioUrl: "",
      fileUrl: "",
      status: "idle",
      settingsOpen: false,
    } satisfies GeminiData,
  };

  const gemini2: PyNode = {
    id: gemini2Id,
    type: "gemini",
    position: { x: 960, y: -460 },
    data: {
      label: "Gemini 2.5 Flash #2",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt:
        "Condense the following product description into a tweet-length hook (under 240 characters).",
      imageUrls: [],
      videoUrl: "",
      audioUrl: "",
      fileUrl: "",
      status: "idle",
      settingsOpen: false,
    } satisfies GeminiData,
  };

  const gemini3: PyNode = {
    id: gemini3Id,
    type: "gemini",
    position: { x: 1440, y: 0 },
    data: {
      label: "Gemini 2.5 Flash #3 (Final)",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt:
        "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.",
      imageUrls: [],
      videoUrl: "",
      audioUrl: "",
      fileUrl: "",
      status: "idle",
      settingsOpen: false,
    } satisfies GeminiData,
  };

  const responseNode: PyNode = {
    id: responseId,
    type: "response",
    position: { x: 1920, y: 0 },
    data: {
      label: "Response",
      locked: true,
      slots: [],
    } satisfies ResponseData,
  };

  const edges: PyEdge[] = [
    edge(requestId, imageFieldId, crop1Id, "input_image", "image"),
    edge(requestId, imageFieldId, crop2Id, "input_image", "image"),
    edge(requestId, textFieldId, gemini1Id, "prompt", "text"),
    edge(gemini1Id, "response", gemini2Id, "prompt", "text"),
    edge(gemini2Id, "response", gemini3Id, "prompt", "text"),
    edge(crop1Id, "output_image", gemini3Id, "image", "image"),
    edge(crop2Id, "output_image", gemini3Id, "image", "image"),
    edge(gemini3Id, "response", responseId, "result", "any"),
    edge(crop2Id, "output_image", responseId, "result", "image"),
  ];

  return {
    nodes: [requestNode, crop1, crop2, gemini1, gemini2, gemini3, responseNode],
    edges,
  };
}

function edge(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  kind: "text" | "image" | "any"
): PyEdge {
  const colorMap: Record<string, string> = {
    text: "#f59e0b",
    image: "#3b82f6",
    any: "#22c55e",
  };
  return {
    id: `edge_${nanoid(10)}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    animated: false,
    style: { stroke: colorMap[kind], strokeWidth: 2 },
  };
}