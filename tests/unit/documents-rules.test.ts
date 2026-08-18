import { describe, it, expect } from "vitest";
import {
  verhoeffValid,
  aadhaarVerhoeffValid,
  runDeterministicRules,
  namesMatch,
} from "@/lib/documents/rules";

describe("verhoeff checksum", () => {
  it("accepts known-good reference vectors", () => {
    expect(verhoeffValid("2363")).toBe(true);
    expect(verhoeffValid("1234568")).toBe(true);
    expect(verhoeffValid("13375")).toBe(true);
  });

  it("rejects numbers with a corrupted check digit", () => {
    expect(verhoeffValid("2364")).toBe(false);
    expect(verhoeffValid("1234567")).toBe(false);
    expect(verhoeffValid("13376")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(verhoeffValid("abc")).toBe(false);
    expect(verhoeffValid("")).toBe(false);
  });
});

describe("aadhaar verhoeff", () => {
  it("accepts real UIDAI-valid numbers", () => {
    expect(aadhaarVerhoeffValid("234567890124")).toBe(true);
    expect(aadhaarVerhoeffValid("999999990019")).toBe(true);
  });

  it("rejects the popular-but-invalid doc example", () => {
    expect(aadhaarVerhoeffValid("234567890123")).toBe(false);
  });
});

describe("deterministic rules", () => {
  const field = (v: string | null) => ({ value: v });

  it("AADHAAR: PASS when a Verhoeff-valid number + name + DOB are present", () => {
    const out = runDeterministicRules("AADHAAR", {
      aadhaarNumber: field("234567890124"),
      fullName: field("Ramesh Kumar"),
      dateOfBirth: field("1990-05-20"),
    });
    expect(out.pass).toBe(true);
    expect(out.fail).toBe(false);
    expect(out.review).toBe(false);
  });

  it("AADHAAR: FAIL on bad checksum", () => {
    const out = runDeterministicRules("AADHAAR", {
      aadhaarNumber: field("234567890123"),
      fullName: field("Ramesh Kumar"),
      dateOfBirth: field("1990-05-20"),
    });
    expect(out.fail).toBe(true);
    expect(out.pass).toBe(false);
  });

  it("AADHAAR: FAIL on non-12-digit length", () => {
    const out = runDeterministicRules("AADHAAR", {
      aadhaarNumber: field("12345"),
      fullName: field("Ramesh Kumar"),
      dateOfBirth: field("1990-05-20"),
    });
    expect(out.fail).toBe(true);
  });

  it("AADHAAR: REVIEW_REQUIRED when required fields are missing", () => {
    const out = runDeterministicRules("AADHAAR", {
      aadhaarNumber: field(null),
      fullName: field(null),
      dateOfBirth: field(null),
    });
    expect(out.review).toBe(true);
    expect(out.pass).toBe(false);
  });

  it("AADHAAR: FAIL on future/invalid DOB", () => {
    const out = runDeterministicRules("AADHAAR", {
      aadhaarNumber: field("234567890124"),
      fullName: field("Ramesh Kumar"),
      dateOfBirth: field("2999-01-01"),
    });
    expect(out.fail).toBe(true);
  });

  it("PAN: PASS on structurally valid PAN", () => {
    const out = runDeterministicRules("PAN", {
      panNumber: field("ABCPD1234F"),
      fullName: field("Ramesh Kumar"),
    });
    expect(out.pass).toBe(true);
    expect(out.fail).toBe(false);
  });

  it("PAN: FAIL on wrong format", () => {
    expect(runDeterministicRules("PAN", { panNumber: field("1234"), fullName: field("R") }).fail).toBe(true);
  });

  it("PAN: FAIL on invalid 4th-char entity type", () => {
    const out = runDeterministicRules("PAN", {
      panNumber: field("ABCDE1234F".replace("C", "E")),
      fullName: field("Ramesh Kumar"),
    });
    expect(out.fail).toBe(true);
  });

  it("PAN: FAIL on serial 0000", () => {
    const out = runDeterministicRules("PAN", {
      panNumber: field("ABCDE0000F"),
      fullName: field("Ramesh Kumar"),
    });
    expect(out.fail).toBe(true);
  });

  it("BANK_STATEMENT: PASS on valid account + IFSC + holder", () => {
    const out = runDeterministicRules("BANK_STATEMENT", {
      accountNumber: field("123456789012"),
      ifsc: field("HDFC0001234"),
      accountHolderName: field("Ramesh Kumar"),
    });
    expect(out.pass).toBe(true);
  });

  it("BANK_STATEMENT: FAIL on malformed IFSC", () => {
    const out = runDeterministicRules("BANK_STATEMENT", {
      accountNumber: field("123456789012"),
      ifsc: field("HDFC123"),
      accountHolderName: field("Ramesh Kumar"),
    });
    expect(out.fail).toBe(true);
  });

  it("OTHER: no rules → always pass with empty results", () => {
    const out = runDeterministicRules("OTHER", {});
    expect(out.pass).toBe(true);
    expect(out.results).toHaveLength(0);
  });
});

describe("namesMatch", () => {
  it("matches ignoring titles and punctuation", () => {
    expect(namesMatch("Mr Ramesh Kumar", "Ramesh Kumar")).toBe(true);
    expect(namesMatch("RAMESH KUMAR", "Ramesh Kumar")).toBe(true);
  });

  it("returns false on empty or very different names", () => {
    expect(namesMatch(null, "Ramesh")).toBe(false);
    expect(namesMatch("John", "Alice")).toBe(false);
  });
});
