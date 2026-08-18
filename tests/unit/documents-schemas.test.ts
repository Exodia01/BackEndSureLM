import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  DocumentExtractionSchemas,
  ExtractField,
  ExtractedFieldSchema,
} from "@/lib/documents/schemas";
import { validateExtractedFields } from "@/lib/documents/extract";

const aadhaarField = (v: string | null) => ({
  value: v,
  confidence: 0.99,
  extractionMode: "EXPLICIT",
});

describe("extraction field schema", () => {
  it("rejects confidence outside [0,1]", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ value: "x", confidence: 1.5, extractionMode: "EXPLICIT" })
    ).toThrow();
  });

  it("rejects an unknown extraction mode", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ value: "x", confidence: 0.5, extractionMode: "GUESSED" })
    ).toThrow();
  });

  it("accepts a well-formed field", () => {
    const f = ExtractedFieldSchema.parse({
      value: "x",
      confidence: 0.5,
      extractionMode: "INFERRED",
      sourcePage: 2,
    });
    expect(f.extractionMode).toBe("INFERRED");
  });
});

describe("per-document schemas", () => {
  it("AADHAAR: accepts valid 12-digit number, name, DOB", () => {
    const r = DocumentExtractionSchemas.AADHAAR.parse({
      aadhaarNumber: aadhaarField("234567890124"),
      fullName: aadhaarField("Ramesh Kumar"),
      dateOfBirth: aadhaarField("1990-05-20"),
      gender: aadhaarField("M"),
      address: aadhaarField("Mumbai"),
      pinCode: aadhaarField("400001"),
    }) as any;
    expect(r.aadhaarNumber.value).toBe("234567890124");
  });

  it("AADHAAR: rejects an 11-digit aadhaar number", () => {
    expect(() =>
      DocumentExtractionSchemas.AADHAAR.parse({
        aadhaarNumber: aadhaarField("12345678901"),
        fullName: aadhaarField("Ramesh Kumar"),
        dateOfBirth: aadhaarField("1990-05-20"),
        gender: aadhaarField("M"),
        address: aadhaarField("Mumbai"),
        pinCode: aadhaarField("400001"),
      })
    ).toThrow();
  });

  it("AADHAAR: strict — rejects unknown keys", () => {
    expect(() =>
      DocumentExtractionSchemas.AADHAAR.parse({
        aadhaarNumber: aadhaarField("234567890124"),
        fullName: aadhaarField("Ramesh Kumar"),
        dateOfBirth: aadhaarField("1990-05-20"),
        gender: aadhaarField("M"),
        address: aadhaarField("Mumbai"),
        pinCode: aadhaarField("400001"),
        extra: aadhaarField("nope"),
      })
    ).toThrow();
  });

  it("PAN: uppercases the pan value via transform", () => {
    const r = DocumentExtractionSchemas.PAN.parse({
      panNumber: aadhaarField("abcde1234f"),
      fullName: aadhaarField("Ramesh Kumar"),
      dateOfBirth: null,
      fatherName: null,
    }) as any;
    expect(r.panNumber.value).toBe("ABCDE1234F");
  });

  it("PAN: rejects a malformed pan", () => {
    expect(() =>
      DocumentExtractionSchemas.PAN.parse({
        panNumber: aadhaarField("ABCD1234E"),
        fullName: aadhaarField("Ramesh Kumar"),
        dateOfBirth: null,
        fatherName: null,
      })
    ).toThrow();
  });

  it("BANK_STATEMENT: accepts a valid IFSC and 6-18 digit account", () => {
    const r = DocumentExtractionSchemas.BANK_STATEMENT.parse({
      accountNumber: aadhaarField("123456789012"),
      ifsc: aadhaarField("HDFC0001234"),
      accountHolderName: aadhaarField("Ramesh Kumar"),
      branch: null,
      openingBalance: null,
      closingBalance: null,
      statementPeriod: null,
    }) as any;
    expect(r.ifsc.value).toBe("HDFC0001234");
  });
});

describe("validateExtractedFields test hook", () => {
  it("parses a valid raw object into typed fields", () => {
    const raw = {
      aadhaarNumber: { value: "234567890124", confidence: 0.99, extractionMode: "EXPLICIT" },
      fullName: { value: "Ramesh Kumar", confidence: 0.98, extractionMode: "EXPLICIT" },
      dateOfBirth: { value: "1990-05-20", confidence: 0.95, extractionMode: "EXPLICIT" },
      gender: { value: "M", confidence: 0.99, extractionMode: "EXPLICIT" },
      address: { value: "Mumbai", confidence: 0.9, extractionMode: "EXPLICIT" },
      pinCode: { value: "400001", confidence: 0.9, extractionMode: "EXPLICIT" },
    };
    const fields = validateExtractedFields("AADHAAR", raw);
    expect(fields.aadhaarNumber.value).toBe("234567890124");
  });

  it("throws on an invalid object", () => {
    expect(() =>
      validateExtractedFields("AADHAAR", {
        aadhaarNumber: { value: "oops", confidence: 0.99, extractionMode: "EXPLICIT" },
      })
    ).toThrow();
  });
});

describe("ExtractField helper", () => {
  it("produces a schema whose value passes the inner schema", () => {
    const s = ExtractField(z.string().min(1));
    const r = s.safeParse({ value: "x", confidence: 0.5, extractionMode: "UNCERTAIN" });
    expect(r.success).toBe(true);
  });
});
