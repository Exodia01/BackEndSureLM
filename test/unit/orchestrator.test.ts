import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentOrchestrator } from "../../lib/ai/orchestrator";

describe("AgentOrchestrator - Unit Tests", () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  it("should generate unique workflow ID for each instance", () => {
    const orch1 = new AgentOrchestrator();
    const orch2 = new AgentOrchestrator();

    expect(orch1.getWorkflowId()).not.toBe(orch2.getWorkflowId());
    expect(orch1.getWorkflowId()).toMatch(/^workflow_\d+/);
  });

  it("should accept custom workflow ID", () => {
    const customId = "custom-workflow-123";
    const orch = new AgentOrchestrator(customId);

    expect(orch.getWorkflowId()).toBe(customId);
  });

  describe("runQueryWorkflow - Input Validation", () => {
    it("should throw error for empty messages array", async () => {
      await expect(
        orchestrator.runQueryWorkflow({ messages: [] })
      ).rejects.toThrow("No messages provided");
    });

    it("should throw error when no user message found", async () => {
      await expect(
        orchestrator.runQueryWorkflow({
          messages: [{ role: "system", content: "System prompt" }],
        })
      ).rejects.toThrow("No user message found");
    });
  });

  describe("buildSystemPrompt", () => {
    it("should format context results with scores", () => {
      const results = [
        { id: "1", content: "First", score: 0.9, rerankedScore: 0.85 },
        { id: "2", content: "Second", score: 0.7, rerankedScore: 0.75 },
      ];

      const prompt = (orchestrator as any).buildSystemPrompt(results);

      expect(prompt).toContain("RERANKED CONTEXT:");
      expect(prompt).toContain("Context 1");
    });
  });
});
