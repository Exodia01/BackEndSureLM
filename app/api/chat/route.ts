import { NextResponse } from "next/server";
import { orchestrateQuery, orchestrateQueryStreaming } from "@/lib/orchestration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, sessionId, stream = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    if (stream) {
      const generator = await orchestrateQueryStreaming({ messages, sessionId });
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of generator) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
      
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    const response = await orchestrateQuery({ messages, sessionId });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat orchestration error:", error);

    try {
      const body = await request.json();
      const { messages, sessionId } = body;

      const fallbackGenerator = await orchestrateQueryStreaming({
        messages,
        sessionId,
      });

      const fallbackStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of fallbackGenerator) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(fallbackStream, {
        headers: {
          "Content-Type": "text/plain",
          "Transfer-Encoding": "chunked",
        },
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: "Both primary and fallback orchestration failed" },
        { status: 503 }
      );
    }
  }
}

export async function GET(request: Request) {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "orchestration-api",
  };

  return NextResponse.json(healthCheck);
}
