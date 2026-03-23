import { PageIndexApi } from "@pageindex/sdk";
import { getConfigFromRequest, validateConfig } from "@/lib/config";

export const maxDuration = 60;

interface ChatRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  docIds?: string[];
}

export async function POST(req: Request) {
  const config = getConfigFromRequest(req);
  const { valid, missing } = validateConfig(config);

  if (!valid) {
    return Response.json(
      { error: `Missing configuration: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const { messages, docIds } = (await req.json()) as ChatRequest;

  const api = new PageIndexApi({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
  });

  const docId =
    docIds && docIds.length > 0
      ? docIds.length === 1
        ? docIds[0]
        : docIds
      : undefined;

  const stream = await api.chatCompletions({
    messages,
    doc_id: docId,
    stream: true,
    enable_citations: false,
    stream_metadata: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
