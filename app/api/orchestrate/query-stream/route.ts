import { NextResponse } from "next/server";
import { orchestrateQueryStreaming } from "@/lib/orchestration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const stream = await orchestrateQueryStreaming({ messages, sessionId });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Orchestration stream error:", error);
    
    return NextResponse.json(
      { 
        error: "Stream failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
