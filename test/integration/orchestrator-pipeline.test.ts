import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AgentMessage } from "../../types/orchestrator";

const TEST_CHUNK_ID = "test_orch_" + Date.now();
beforeAll(async () => {
  console.log("Orchestrator Integration Tests - Requires PostgreSQL, Qdrant, Ollama");
});

afterAll(() => {
  console.log("Cleaning up test data...");
});

describe("AgentOrchestrator - Integration Tests", () => {
  it("should run full query workflow with real retrieval", { timeout: 60000 }, async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const result = await orchestrator.runQueryWorkflow({
      messages: [{ role: "user", content: "What is Term Life Insurance?" }],
      sessionId: "test-session-123",
    });

    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("context");
    expect(result).toHaveProperty("toolsUsed");

    console.log("Tools used:", result.toolsUsed);
    console.log("Context sources:", result.context.map(c => c.source));
  });

  it("should handle streaming query workflow", { timeout: 60000 }, async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const stream = await orchestrator.runQueryWorkflowStreaming({
      messages: [{ role: "user", content: "Test query" }],
      sessionId: "test-stream-123",
    });

    expect(stream).toBeDefined();
  });

  it("should verify Ollama health before running tests", { timeout: 10000 }, async () => {
    const response = await fetch(process.env.OLLAMA_HOST || "http://localhost:11434");
    expect(response.ok).toBe(true);
    
    const data = await response.text();
    expect(data).toContain("running");
  });

  it("should handle empty retrieval results gracefully", { timeout: 60000 }, async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const result = await orchestrator.runQueryWorkflow({
      messages: [{ role: "user", content: "Query with no matches" }],
    });

    expect(result.content).toBeDefined();
  });
});

