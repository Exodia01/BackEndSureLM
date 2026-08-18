import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai/agents/llm", () => ({
  generateLLMResponse: vi.fn(),
}));

const { classifyByKeywords, classifyDocument, VALID_TYPES } = await import(
  "@/lib/documents/classify"
);
const { generateLLMResponse } = await import("@/lib/ai/agents/llm");

describe("classifyByKeywords", () => {
  it("classifies an Aadhaar text by the 4x4x4 number pattern", () => {
    const r = classifyByKeywords("UIDAI Aadhaar 2345 6789 0124");
    expect(r?.docType).toBe("AADHAAR");
    expect(r?.method).toBe("keyword");
    expect(r && r.confidence).toBeGreaterThan(0.8);
  });

  it("classifies a PAN by the PAN pattern", () => {
    const r = classifyByKeywords("Permanent Account Number ABCDE1234F");
    expect(r?.docType).toBe("PAN");
  });

  it("classifies a bank statement", () => {
    const r = classifyByKeywords("Account Statement IFSC Available Balance");
    expect(r?.docType).toBe("BANK_STATEMENT");
  });

  it("classifies a salary slip as income proof", () => {
    const r = classifyByKeywords("Salary Slip Annual Income Gross Salary");
    expect(r?.docType).toBe("INCOME_PROOF");
  });

  it("classifies a policy bond", () => {
    const r = classifyByKeywords("Insurance Policy Policy Number Sum Assured");
    expect(r?.docType).toBe("POLICY_DOCUMENT");
  });

  it("returns null for unrecognizable text", () => {
    expect(classifyByKeywords("gibberish whatever")).toBeNull();
  });
});

describe("classifyDocument LLM fallback", () => {
  it("falls back to the LLM when keywords match nothing", async () => {
    (generateLLMResponse as ReturnType<typeof vi.fn>).mockResolvedValue(
      '{"docType": "ADDRESS_PROOF", "confidence": 0.8}'
    );
    const r = await classifyDocument("some ambiguous text with no keywords");
    expect(r.docType).toBe("ADDRESS_PROOF");
    expect(r.method).toBe("llm");
  });

  it("coerces an invalid LLM answer to OTHER", async () => {
    (generateLLMResponse as ReturnType<typeof vi.fn>).mockResolvedValue(
      '{"docType": "NOT_A_TYPE", "confidence": 1}'
    );
    const r = await classifyDocument("unrecognizable text");
    expect(r.docType).toBe("OTHER");
    expect(r.confidence).toBe(0.3);
  });

  it("falls back to OTHER when the LLM fails entirely", async () => {
    (generateLLMResponse as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ollama down"));
    const r = await classifyDocument("unrecognizable text");
    expect(r.docType).toBe("OTHER");
  });

  it("uses keyword classification without touching the LLM", async () => {
    (generateLLMResponse as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("never called"));
    const r = await classifyDocument("UIDAI Aadhaar 2345 6789 0124");
    expect(r.docType).toBe("AADHAAR");
    expect(r.method).toBe("keyword");
  });
});

it("exposes a fixed set of valid document types", () => {
  expect(VALID_TYPES).toContain("AADHAAR");
  expect(VALID_TYPES).toContain("OTHER");
});
