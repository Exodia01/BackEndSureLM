/**
 * PII masking utilities. Every value that could reach logs, audit metadata, or
 * error messages from the document pipeline must pass through these before it
 * is persisted or logged.
 */

/** Mask a PAN: keep first 3 and last char: "ABCDE1234F" -> "ABC****F". */
export function maskPan(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const pan = value.trim().toUpperCase();
  if (pan.length < 6) return "*".repeat(pan.length);
  return `${pan.slice(0, 3)}${"*".repeat(Math.max(4, pan.length - 4))}${pan.slice(-1)}`;
}

/** Mask an Aadhaar: keep last 2: "1234 5678 9012" -> "XXXXXXXXX012". */
export function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 2) return "*".repeat(digits.length);
  return `${"X".repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`;
}

/** Mask a phone number: keep last 2 digits: "+91 98765 43210" -> "+91 98765 4XX10". */
export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length <= 3) return "*".repeat(trimmed.length);
  const keep = trimmed.slice(0, Math.max(0, trimmed.length - 2));
  return `${keep}${"X".repeat(2)}`;
}

/** Mask an email: "first.last@example.com" -> "f****t@example.com". */
export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const at = value.indexOf("@");
  if (at <= 1) return "*@*";
  return `${value[0]}${"*".repeat(Math.max(3, at - 2))}${value.slice(at - 1)}`;
}

/** Mask a full name: keep first char of first token only. */
export function maskName(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 0) return "****";
  return `${tokens[0][0]}${"*".repeat(Math.max(2, tokens[0].length - 1))}${tokens.length > 1 ? ` ${tokens.slice(1).map(() => "*").join(" ")}` : ""}`;
}

/**
 * Deep-mask known PII field names inside a JSON-serializable object.
 * Applied to audit metadata and any error payloads derived from documents.
 */
/**
 * Fully redact a value, preserving length.
 */
const maskRedact = (v: string): string => "*".repeat(v.length);

/**
 * Scrub known identifier patterns from free text (PAN, Aadhaar, phone,
 * email). Used for review notes, error messages, and audit metadata so that
 * free-form text never persists raw identifiers.
 */
export function maskFreeText(value: string): string {
  if (!value) return value;
  let out = value;
  out = out.replace(PII_PATTERNS.aadhaar, "XXXXXXXXXXXX");
  out = out.replace(PII_PATTERNS.pan, "XXXXXXXXXX");
  out = out.replace(PII_PATTERNS.phone, "XXXXXXXXXX");
  out = out.replace(PII_PATTERNS.email, "***@***");
  return out;
}

/**
 * Lowercase-keyed maskers. Keys match `k.toLowerCase()`.
 * The list covers the full document extraction field set, including nested
 * object keys and free-form audit fields. Recursion in maskDocumentPII handles
 * future-proof nested structures.
 */
const PII_MASKERS: Record<string, (v: string) => string | null> = {
  // Identity documents
  pan: maskPan,
  aadhaar: maskAadhaar,
  aadhaarnumber: maskAadhaar,
  pannumber: maskPan,
  identitynumber: maskRedact,
  identityno: maskRedact,
  // Contact
  phone: maskPhone,
  mobile: maskPhone,
  phonenumber: maskPhone,
  email: maskEmail,
  emailid: maskEmail,
  // Names
  name: maskName,
  fullname: maskName,
  holdername: maskName,
  accountholdername: maskName,
  applicantname: maskName,
  insuredname: maskName,
  employeename: maskName,
  fathername: maskName,
  // Financial identifiers / figures
  accountnumber: maskRedact,
  accountno: maskRedact,
  ifsc: maskRedact,
  policyNumber: maskRedact,
  policynumber: maskRedact,
  policyno: maskRedact,
  annualincome: maskRedact,
  premiumamount: maskRedact,
  openingbalance: maskRedact,
  closingbalance: maskRedact,
  pin: maskRedact,
  pincode: maskRedact,
  // Dates / personal
  dateofbirth: maskRedact,
  dob: maskRedact,
  address: maskRedact,
  branch: maskRedact,
  gender: maskRedact,
  statementperiod: maskRedact,
  incomeperiod: maskRedact,
  // Raw / free-form content
  ocrtext: () => "[masked ocrText]",
  rawresponse: () => "[masked rawResponse]",
  sourceText: () => "[masked sourceText]",
  sourcetext: () => "[masked sourceText]",
  // Free-form audit/error fields
  notes: maskFreeText,
  reviewnotes: maskFreeText,
  reason: maskFreeText,
  error: maskFreeText,
  message: maskFreeText,
  lasterror: maskFreeText,
  lastError: maskFreeText,
};

export function maskDocumentPII<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => maskDocumentPII(v, depth + 1)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      const str = typeof v === "string" ? v : undefined;
      const masker = str ? PII_MASKERS[lk] : undefined;
      out[k] = masker && str ? masker(str) : maskDocumentPII(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

/** Reusable regex set exported for tests. */
export const PII_PATTERNS = {
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  aadhaar: /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/,
  phone: /(?<!\d)(?:\+?91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}(?!\d)/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
};
