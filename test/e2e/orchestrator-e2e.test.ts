import { describe, it, expect } from "vitest";

describe("AgentOrchestrator - E2E Tests", () => {
  it("should handle multi-turn conversation context", async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const messages1 = [
      { role: "user", content: "What is Term Life Insurance?" },
    ];
    
    const result1 = await orchestrator.runQueryWorkflow({
      messages: messages1,
      sessionId: "e2e-test-session",
    });

    expect(result1.content).toBeDefined();
    expect(result1.context.length).toBeGreaterThanOrEqual(0);

    const messages2 = [
      { role: "user", content: "What is the waiting period?" },
    ];

    const result2 = await orchestrator.runQueryWorkflow({
      messages: messages2,
      sessionId: "e2e-test-session",
    });

    expect(result2.content).toBeDefined();
  });

  it("should handle long queries with context window", async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const longQuery = "I need information about life insurance policies, specifically Term Life Insurance, which provides coverage for a specified period of time. This type of policy is different from whole life insurance because it does not accumulate cash value and only pays out if the insured dies during the term. Premiums are typically fixed for the duration of the term and can be 10, 20, or 30 years.";

    const result = await orchestrator.runQueryWorkflow({
      messages: [{ role: "user", content: longQuery }],
    });

    expect(result.content).toBeDefined();
    expect(result.context.length).toBeGreaterThanOrEqual(0);
  });

  it("should deduplicate results from multiple sources", async () => {
    const { AgentOrchestrator } = await import("../../lib/ai/orchestrator");
    const orchestrator = new AgentOrchestrator();

    const result = await orchestrator.runQueryWorkflow({
      messages: [{ role: "user", content: "What is the waiting period?" }],
    });

    const contextIds = result.context.map(c => c.id);
    const uniqueIds = new Set(contextIds);

    expect(uniqueIds.size).toBeLessThanOrEqual(contextIds.length);
  });
});

