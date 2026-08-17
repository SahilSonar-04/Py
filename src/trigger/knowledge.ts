import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/** Split text into overlapping chunks for embedding. */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function embed(genAI: GoogleGenerativeAI, text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const request = {
    content: { role: "user", parts: [{ text }] },
    outputDimensionality: 768,
  } as unknown as Parameters<typeof model.embedContent>[0];
  const result = await model.embedContent(request);
  return result.embedding.values;
}

// ---------- Ingest: chunk + embed + store ----------

export interface KnowledgeIngestPayload {
  sourceId: string;
  text: string;
}

export interface KnowledgeIngestResult {
  chunkCount: number;
}

const EMBED_CONCURRENCY = 8;

export const knowledgeIngestTask = task({
  id: "knowledge-ingest",
  maxDuration: 120,
  run: async (payload: KnowledgeIngestPayload): Promise<KnowledgeIngestResult> => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const chunks = chunkText(payload.text);

    for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
      const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
      const vectors = await Promise.all(batch.map((c) => embed(genAI, c)));

      await Promise.all(
        vectors.map((vector, j) => {
          const vectorLiteral = `[${vector.join(",")}]`;
          return prisma.$executeRawUnsafe(
            `INSERT INTO "KnowledgeChunk" (id, "sourceId", content, embedding, "chunkIndex")
             VALUES (gen_random_uuid()::text, $1, $2, $3::vector, $4)`,
            payload.sourceId,
            batch[j],
            vectorLiteral,
            i + j
          );
        })
      );
    }

    return { chunkCount: chunks.length };
  },
});

// ---------- Retrieve: embed query + cosine similarity search ----------

export interface KnowledgeRetrievePayload {
  sourceId: string;
  query: string;
  topK: number;
}

export interface KnowledgeRetrieveResult {
  chunks: string[];
}

export const knowledgeRetrieveTask = task({
  id: "knowledge-retrieve",
  maxDuration: 30,
  run: async (payload: KnowledgeRetrievePayload): Promise<KnowledgeRetrieveResult> => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const queryVector = await embed(genAI, payload.query);
    const vectorLiteral = `[${queryVector.join(",")}]`;

    const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
      `SELECT content FROM "KnowledgeChunk"
       WHERE "sourceId" = $1
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      payload.sourceId,
      vectorLiteral,
      payload.topK
    );

    return { chunks: rows.map((r) => r.content) };
  },
});
