import { describe, it, expect } from "vitest";
import {
  maskPan,
  maskAadhaar,
  maskPhone,
  maskEmail,
  maskName,
  maskDocumentPII,
  PII_PATTERNS,
} from "@/lib/documents/pii";

describe("PII masking", () => {
  it("masks a PAN keeping only the first 3 and last character", () => {
    expect(maskPan("ABCDE1234F")).toBe("ABC******F");
  });

  it("masks an Aadhaar keeping only the last 2 digits", () => {
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXXXXXXXX12");
  });

  it("masks a phone keeping only the last 2 digits", () => {
    expect(maskPhone("+91 98765 43210")).toBe("+91 98765 432XX");
  });

  it("masks an email keeping first and last char of the local part", () => {
    expect(maskEmail("first.last@example.com")).toBe("f********t@example.com");
  });

  it("masks a full name keeping only the first initial", () => {
    expect(maskName("Ramesh Kumar")).toBe("R***** *");
  });

  it("returns null for empty values", () => {
    expect(maskPan(null)).toBeNull();
    expect(maskAadhaar("")).toBe("");
  });
});

describe("maskDocumentPII deep masking", () => {
  it("masks known PII keys in nested objects", () => {
    const masked = maskDocumentPII({
      document: {
        pan: "ABCDE1234F",
        aadhaar: "234567890124",
        fullName: "Ramesh Kumar",
      },
      meta: { ocrText: "RAW OCR HERE" },
      safe: "keep-me",
    });
    expect(masked.document.pan).toBe("ABC******F");
    expect(masked.document.aadhaar).toBe("XXXXXXXXXX24");
    expect(masked.document.fullName).toBe("R***** *");
    expect(masked.meta.ocrText).toBe("[masked ocrText]");
    expect(masked.safe).toBe("keep-me");
  });

  it("masks PII inside arrays", () => {
    const masked = maskDocumentPII({ list: [{ pan: "ABCDE1234F" }] });
    expect((masked as any).list[0].pan).toBe("ABC******F");
  });

  it("does not throw on non-object primitives", () => {
    expect(maskDocumentPII("plain")).toBe("plain");
    expect(maskDocumentPII(42)).toBe(42);
    expect(maskDocumentPII(null)).toBeNull();
  });
});

describe("PII patterns", () => {
  it("detects a PAN", () => {
    expect(PII_PATTERNS.pan.test("PAN: ABCDE1234F")).toBe(true);
  });

  it("detects an Aadhaar with or without spaces", () => {
    expect(PII_PATTERNS.aadhaar.test("2345 6789 0124")).toBe(true);
    expect(PII_PATTERNS.aadhaar.test("234567890124")).toBe(true);
  });

  it("detects an Indian phone number", () => {
    expect(PII_PATTERNS.phone.test("+91 98765 43210")).toBe(true);
    expect(PII_PATTERNS.phone.test("9876543210")).toBe(true);
  });

  it("detects an email", () => {
    expect(PII_PATTERNS.email.test("contact@example.com")).toBe(true);
  });
});
