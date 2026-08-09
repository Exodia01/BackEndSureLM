/**
 * Zod schemas for document field extraction.
 *
 * Every extracted field carries provenance: a confidence in [0,1] and an
 * extractionMode of EXPLICIT (verbatim from the document), INFERRED (derived),
 * or UNCERTAIN (present but ambiguous). Missing fields are null — the
 * extraction layer NEVER fabricates values.
 */
import { z } from "zod";

export const ExtractionModeSchema = z.enum(["EXPLICIT", "INFERRED", "UNCERTAIN"]);
export type ExtractionMode = z.infer<typeof ExtractionModeSchema>;

export const ExtractedFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  extractionMode: ExtractionModeSchema,
  /** Page (1-based) the field was found on; null when not page-cited. */
  sourcePage: z.number().int().min(1).nullable().optional(),
  /** Short verbatim snippet the value was derived from. */
  sourceText: z.string().max(500).nullable().optional(),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

/** PAN: ABCDE1234F. Verified by Verhoeff in validation, not here. */
export const panValueSchema = z
  .string()
  .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/)
  .transform((v) => v.toUpperCase());

/** Aadhaar: 12 digits, optional spaces. Checksum is Verhoeff (validated later). */
export const aadhaarValueSchema = z
  .string()
  .regex(/^[2-9][0-9]{11}$/)
  .transform((v) => v.replace(/\s+/g, ""));

export const dateValueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const phoneValueSchema = z.string().regex(/^\+?[0-9\s-]{8,15}$/);
export const emailValueSchema = z.string().email();
export const nameValueSchema = z.string().min(1).max(120);
export const numberValueSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

export const ExtractField = (schema: z.ZodSchema): z.ZodSchema =>
  ExtractedFieldSchema.extend({
    value: schema.nullable().optional(),
  }).passthrough();

/**
 * Per-document field definitions. Every value is stored as { value, confidence,
 * extractionMode, sourcePage?, sourceText? }.
 */
export const DocumentExtractionSchemas = {
  AADHAAR: z
    .object({
      aadhaarNumber: ExtractField(aadhaarValueSchema),
      fullName: ExtractField(nameValueSchema),
      dateOfBirth: ExtractField(dateValueSchema),
      gender: ExtractField(z.string()),
      address: ExtractField(z.string()),
      pinCode: ExtractField(z.string().regex(/^\d{6}$/)),
    })
    .strict(),
  PAN: z
    .object({
      panNumber: ExtractField(panValueSchema),
      fullName: ExtractField(nameValueSchema),
      dateOfBirth: ExtractField(dateValueSchema).nullable(),
      fatherName: ExtractField(nameValueSchema).nullable(),
    })
    .strict(),
  BANK_STATEMENT: z
    .object({
      accountNumber: ExtractField(z.string().regex(/^\d{6,18}$/)),
      ifsc: ExtractField(z.string().regex(/^[A-Z]{4}[0-9]{7}$/)),
      accountHolderName: ExtractField(nameValueSchema),
      branch: ExtractField(z.string()).nullable(),
      openingBalance: ExtractField(numberValueSchema).nullable(),
      closingBalance: ExtractField(numberValueSchema).nullable(),
      statementPeriod: ExtractField(z.string()).nullable(),
    })
    .strict(),
  INCOME_PROOF: z
    .object({
      annualIncome: ExtractField(numberValueSchema),
      incomePeriod: ExtractField(z.string()).nullable(),
      employeeName: ExtractField(nameValueSchema).nullable(),
      employer: ExtractField(z.string()).nullable(),
    })
    .strict(),
  ADDRESS_PROOF: z
    .object({
      fullName: ExtractField(nameValueSchema),
      address: ExtractField(z.string()),
      pinCode: ExtractField(z.string().regex(/^\d{6}$/)),
      documentType: ExtractField(z.string()).nullable(),
    })
    .strict(),
  IDENTITY_PROOF: z
    .object({
      fullName: ExtractField(nameValueSchema),
      dateOfBirth: ExtractField(dateValueSchema).nullable(),
      identityNumber: ExtractField(z.string()).nullable(),
    })
    .strict(),
  POLICY_DOCUMENT: z
    .object({
      policyName: ExtractField(z.string()).nullable(),
      policyNumber: ExtractField(z.string()).nullable(),
      insuredName: ExtractField(nameValueSchema).nullable(),
      premiumAmount: ExtractField(numberValueSchema).nullable(),
      policyTerm: ExtractField(z.string()).nullable(),
    })
    .strict(),
  OTHER: z
    .object({
      documentTitle: ExtractField(z.string()).nullable(),
      summary: ExtractField(z.string()).nullable(),
    })
    .strict(),
} as const;

export type DocumentTypeKey = keyof typeof DocumentExtractionSchemas;

export const DOCUMENT_TYPE_VALUES = Object.keys(
  DocumentExtractionSchemas
) as DocumentTypeKey[];

export type DocumentExtractionRecord = {
  docType: DocumentTypeKey;
  fields: Record<string, { value: string | null; confidence: number; extractionMode: ExtractionMode; sourcePage?: number | null; sourceText?: string | null }>;
  extractedAt: string;
  model: string;
};
