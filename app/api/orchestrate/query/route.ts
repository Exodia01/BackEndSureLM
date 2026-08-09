import { NextResponse } from "next/server";
import { orchestrateQuery, orchestrateQueryStreaming } from "@/lib/ai/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, sessionId, agentId } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const response = await orchestrateQuery({
      messages,
      sessionId,
      agentId,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Orchestration query error:", error);
    
    return NextResponse.json(
      { 
        error: "Orchestration failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
