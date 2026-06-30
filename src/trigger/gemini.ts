import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiTaskPayload {
  model: string; // e.g. "gemini-3.1-pro"
  prompt: string;
  systemPrompt?: string;
  imageUrls?: string[]; // supports multiple connections per spec (vision)
}

export interface GeminiTaskResult {
  response: string;
}

export const geminiTask = task({
  id: "gemini-generate",
  maxDuration: 60,
  run: async (payload: GeminiTaskPayload): Promise<GeminiTaskResult> => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      throw new Error(
        "GOOGLE_GENERATIVE_AI_API_KEY is not configured - set a real key from Google AI Studio"
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = mapModelName(payload.model);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: payload.systemPrompt || undefined,
    });

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: payload.prompt },
    ];

    for (const imageUrl of payload.imageUrls ?? []) {
      const { data, mimeType } = await fetchImageAsBase64(imageUrl);
      parts.push({ inlineData: { data, mimeType } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    return { response: text };
  },
});

function mapModelName(modelId: string): string {
  const map: Record<string, string> = {
    "gemini-3.1-pro": "gemini-3.1-pro",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
  };
  return map[modelId] ?? modelId;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  let buffer: Buffer;
  let mimeType = "image/png";

  if (url.startsWith("/uploads/")) {
    const path = await import("path");
    const { readFile } = await import("fs/promises");
    const filePath = path.join(process.cwd(), "public", url);
    buffer = await readFile(filePath);
    if (url.endsWith(".jpg") || url.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (url.endsWith(".webp")) mimeType = "image/webp";
    else if (url.endsWith(".gif")) mimeType = "image/gif";
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image for vision input: ${res.status}`);
    mimeType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  return { data: buffer.toString("base64"), mimeType };
}
