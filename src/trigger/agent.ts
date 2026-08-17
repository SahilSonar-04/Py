import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import type { ToolCallLogEntry } from "@/types/workflow";

export interface AgentTaskPayload {
  prompt: string;
  enabledTools: string[];
  knowledgeSourceId?: string; // if knowledge_lookup is enabled
}

export interface AgentTaskResult {
  response: string;
  toolCallLog: ToolCallLogEntry[];
}

const TOOL_DECLARATIONS: Record<string, FunctionDeclaration> = {
  search_web: {
    name: "search_web",
    description: "Search the web for current information on a topic. Returns relevant search result snippets.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "The search query" },
      },
      required: ["query"],
    },
  },
  knowledge_lookup: {
    name: "knowledge_lookup",
    description: "Look up information from the ingested knowledge base documents. Returns the most relevant text chunks.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "The search query to find relevant document chunks" },
      },
      required: ["query"],
    },
  },
};

async function executeSearchWeb(query: string): Promise<string> {
  // Use a simple web search approach — DuckDuckGo instant answer API (no API key required)
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();

    const parts: string[] = [];
    if (data.Abstract) parts.push(data.Abstract);
    if (data.Answer) parts.push(data.Answer);
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 3)) {
        if (topic.Text) parts.push(topic.Text);
      }
    }

    return parts.length > 0
      ? parts.join("\n\n")
      : `No instant results found for "${query}". The search API returned no relevant snippets.`;
  } catch (err) {
    return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeKnowledgeLookup(
  query: string,
  sourceId: string | undefined
): Promise<string> {
  if (!sourceId) {
    return "No knowledge source configured — connect a Knowledge node upstream or provide a sourceId.";
  }

  try {
    const { knowledgeRetrieveTask } = await import("./knowledge");
    const { runs } = await import("@trigger.dev/sdk/v3");

    const handle = await knowledgeRetrieveTask.trigger({
      sourceId,
      query,
      topK: 4,
    });
    const result = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (result.status !== "COMPLETED") {
      return "Knowledge retrieval task failed.";
    }

    const output = result.output as { chunks: string[] };
    return output.chunks.length > 0
      ? output.chunks.join("\n\n---\n\n")
      : "No relevant chunks found in the knowledge base.";
  } catch (err) {
    return `Knowledge lookup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export const agentTask = task({
  id: "agent-tool-call",
  maxDuration: 120,
  run: async (payload: AgentTaskPayload): Promise<AgentTaskResult> => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Build tool declarations from enabled tools
    const functionDeclarations = payload.enabledTools
      .filter((t) => t in TOOL_DECLARATIONS)
      .map((t) => TOOL_DECLARATIONS[t as keyof typeof TOOL_DECLARATIONS]);

    const modelConfig: Parameters<typeof genAI.getGenerativeModel>[0] = {
      model: "gemini-2.5-flash",
    };

    // Only add tools if any are enabled
    const tools = functionDeclarations.length > 0
      ? [{ functionDeclarations }]
      : undefined;

    const model = genAI.getGenerativeModel(modelConfig);

    // Only pass tools if any are enabled
    const chatOptions = tools ? { tools } : {};
    const chat = model.startChat(chatOptions);

    const toolCallLog: ToolCallLogEntry[] = [];
    let result = await chat.sendMessage(payload.prompt);
    let iterations = 0;
    const MAX_ITERATIONS = 5; // safety limit

    while (result.response.functionCalls()?.length && iterations < MAX_ITERATIONS) {
      iterations++;
      const calls = result.response.functionCalls()!;

      const functionResponses: Array<{
        functionResponse: { name: string; response: Record<string, unknown> };
      }> = [];

      for (const call of calls) {
        const args = (call.args ?? {}) as Record<string, unknown>;
        let toolResult: string;

        if (call.name === "search_web") {
          toolResult = await executeSearchWeb(args.query as string);
        } else if (call.name === "knowledge_lookup") {
          toolResult = await executeKnowledgeLookup(
            args.query as string,
            payload.knowledgeSourceId
          );
        } else {
          toolResult = `Unknown tool: ${call.name}`;
        }

        toolCallLog.push({
          tool: call.name,
          args,
          result: toolResult,
        });

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolResult },
          },
        });
      }

      result = await chat.sendMessage(functionResponses);
    }

    return {
      response: result.response.text(),
      toolCallLog,
    };
  },
});
