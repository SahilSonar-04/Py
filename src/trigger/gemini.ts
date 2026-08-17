import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiTaskPayload {
  model: string; 
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

    try {
      const result = await model.generateContent(parts);
      const text = result.response.text();
      return { response: text };
    } catch (err) {
      console.error(`Gemini call failed for model "${modelName}":`, err);

      const detail =
        err instanceof Error
          ? err.message
          : typeof err === "object"
          ? JSON.stringify(err)
          : String(err);

      const is404 = detail.includes("404") || detail.toLowerCase().includes("not found");
      const is429 = detail.includes("429") || detail.toLowerCase().includes("quota");

      throw new Error(
        is404
          ? `Model "${modelName}" was not found/supported for your API key (404). ` +
            `Update mapModelName() in src/trigger/gemini.ts to a model your key can call. ` +
            `Full detail: ${detail}`
          : is429
          ? `Model "${modelName}" has zero free-tier quota for your API key/project (429). ` +
            `This is a Google account/billing limit, not an app bug - either switch to a model ` +
            `with free-tier quota (e.g. gemini-2.5-flash) in mapModelName(), or enable billing ` +
            `for "${modelName}" in Google AI Studio / Cloud Console. Full detail: ${detail}`
          : `Gemini request failed for model "${modelName}". Detail: ${detail}`
      );
    }
  },
});

function mapModelName(modelId: string): string {
  const map: Record<string, string> = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
  };
  return map[modelId] ?? modelId;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  let buffer: Buffer;
  let mimeType = "image/png";

  if (url.startsWith("/uploads/")) {
    throw new Error(
      `Cannot read local path "${url}" from inside a Trigger.dev task - Trigger.dev's cloud ` +
        `runners don't share a filesystem with Vercel or your local dev server. Make sure ` +
        `USE_LOCAL_UPLOAD_FALLBACK=false and real TRANSLOADIT_* credentials are set (in both ` +
        `Vercel AND the Trigger.dev dashboard's Environment Variables) so uploaded images get ` +
        `real http(s) URLs instead of local paths.`
    );
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image for vision input: ${res.status}`);
    mimeType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  return { data: buffer.toString("base64"), mimeType };
}
