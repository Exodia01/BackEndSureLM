/**
 * Deterministic validation rules for extracted document fields.
 *
 * These run BEFORE any AI-assisted validation and are authoritative:
 *   - PASS         → deterministic checks passed, no ambiguity flagged
 *   - FAIL         → a checksum/format/reality check failed
 *   - REVIEW_REQUIRED → fields could not be confirmed deterministically
 */
import { PII_PATTERNS } from "@/lib/documents/pii";

export interface RuleResult {
  rule: string;
  status: "PASS" | "FAIL" | "REVIEW_REQUIRED";
  message: string;
}

export type RuleFn = (fields: Record<string, { value: string | null }>) => RuleResult;

// ── Verhoeff checksum (used by both PAN and Aadhaar) ────────────────────────
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const n = digits.length;
  for (let i = 0; i < n; i++) {
    const j = i % 8;
    const digit = Number(digits.charAt(n - i - 1));
    c = D[c][P[j][digit]];
  }
  return c === 0;
}

/**
 * NOTE: unlike Aadhaar, the Income Tax Department has NOT published a public
 * check-digit algorithm for PAN. Multiple maintained validators (pramana,
 * nationid, india-validator) deliberately do format + structure only. We
 * therefore validate PAN structurally — entity-type whitelist on the 4th
 * character and a non-trivial serial — and do NOT enforce a checksum that
 * could reject genuine PANs.
 */
const PAN_ENTITY_TYPES = ["A", "B", "C", "F", "G", "H", "J", "L", "P", "T"];

export function aadhaarVerhoeffValid(aadhaar: string): boolean {
  return verhoeffValid(aadhaar);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function get(
  fields: Record<string, { value: string | null }>,
  key: string
): string | null {
  return fields[key]?.value ?? null;
}

function normalizeDigits(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\s+/g, "");
  return /^\d+$/.test(d) ? d : null;
}

function isValidDate(s: string | null): boolean {
  if (!s) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [_, y, mo, da] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(da);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return false;
  }
  // Not in the future; at least 1 year old.
  if (date.getTime() > Date.now()) return false;
  return true;
}

function notFutureDate(s: string | null): boolean {
  if (!s) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && t <= Date.now();
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const t = Date.parse(`${dob}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
}

// ── Rules ───────────────────────────────────────────────────────────────────
const RULES: Record<string, RuleFn[]> = {
  AADHAAR: [
    (f) => {
      const v = get(f, "aadhaarNumber");
      if (!v) return { rule: "aadhaar:present", status: "REVIEW_REQUIRED", message: "Aadhaar number missing" };
      const d = normalizeDigits(v);
      if (!d || d.length !== 12) return { rule: "aadhaar:length", status: "FAIL", message: "Aadhaar must be 12 digits" };
      return { rule: "aadhaar:length", status: "PASS", message: "Aadhaar length OK" };
    },
    (f) => {
      const d = normalizeDigits(get(f, "aadhaarNumber"));
      if (!d || d.length !== 12) return { rule: "aadhaar:verhoeff", status: "REVIEW_REQUIRED", message: "Cannot verify Aadhaar checksum" };
      return aadhaarVerhoeffValid(d)
        ? { rule: "aadhaar:verhoeff", status: "PASS", message: "Aadhaar Verhoeff checksum valid" }
        : { rule: "aadhaar:verhoeff", status: "FAIL", message: "Aadhaar Verhoeff checksum invalid" };
    },
    (f) => {
      const dob = get(f, "dateOfBirth");
      if (!dob) return { rule: "aadhaar:dob", status: "REVIEW_REQUIRED", message: "Date of birth missing" };
      return isValidDate(dob)
        ? { rule: "aadhaar:dob", status: "PASS", message: "Date of birth valid" }
        : { rule: "aadhaar:dob", status: "FAIL", message: "Date of birth invalid or in future" };
    },
    (f) => {
      const name = get(f, "fullName");
      if (!name) return { rule: "aadhaar:name", status: "REVIEW_REQUIRED", message: "Name missing" };
      if (name.length < 2) return { rule: "aadhaar:name", status: "FAIL", message: "Name too short" };
      return { rule: "aadhaar:name", status: "PASS", message: "Name present" };
    },
  ],
  PAN: [
    (f) => {
      const v = get(f, "panNumber");
      if (!v) return { rule: "pan:present", status: "REVIEW_REQUIRED", message: "PAN number missing" };
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) {
        return { rule: "pan:format", status: "FAIL", message: "PAN format invalid" };
      }
      if (!PAN_ENTITY_TYPES.includes(v[3])) {
        return { rule: "pan:entityType", status: "FAIL", message: "PAN 4th character is not a valid entity type" };
      }
      const serial = v.slice(5, 9);
      if (serial === "0000") {
        return { rule: "pan:serial", status: "FAIL", message: "PAN serial cannot be 0000" };
      }
      return { rule: "pan:format", status: "PASS", message: "PAN format and structure valid" };
    },
    (f) => {
      const name = get(f, "fullName");
      if (!name) return { rule: "pan:name", status: "REVIEW_REQUIRED", message: "Name missing" };
      return { rule: "pan:name", status: "PASS", message: "Name present" };
    },
  ],
  BANK_STATEMENT: [
    (f) => {
      const acct = get(f, "accountNumber");
      if (!acct) return { rule: "bank:account", status: "REVIEW_REQUIRED", message: "Account number missing" };
      return /^\d{6,18}$/.test(acct)
        ? { rule: "bank:account", status: "PASS", message: "Account number format valid" }
        : { rule: "bank:account", status: "FAIL", message: "Account number format invalid" };
    },
    (f) => {
      const ifsc = get(f, "ifsc");
      if (!ifsc) return { rule: "bank:ifsc", status: "REVIEW_REQUIRED", message: "IFSC missing" };
      return /^[A-Z]{4}[0-9]{7}$/.test(ifsc)
        ? { rule: "bank:ifsc", status: "PASS", message: "IFSC format valid" }
        : { rule: "bank:ifsc", status: "FAIL", message: "IFSC format invalid" };
    },
    (f) => {
      const name = get(f, "accountHolderName");
      if (!name) return { rule: "bank:name", status: "REVIEW_REQUIRED", message: "Account holder name missing" };
      return { rule: "bank:name", status: "PASS", message: "Account holder name present" };
    },
  ],
  INCOME_PROOF: [
    (f) => {
      const income = get(f, "annualIncome");
      if (!income) return { rule: "income:value", status: "REVIEW_REQUIRED", message: "Income value missing" };
      const n = Number(income.replace(/[^0-9.]/g, ""));
      if (Number.isNaN(n) || n <= 0) return { rule: "income:value", status: "FAIL", message: "Income must be positive" };
      if (n > 1_000_000_000) return { rule: "income:value", status: "FAIL", message: "Income implausibly large" };
      return { rule: "income:value", status: "PASS", message: "Income value plausible" };
    },
  ],
  ADDRESS_PROOF: [
    (f) => {
      const name = get(f, "fullName");
      if (!name) return { rule: "address:name", status: "REVIEW_REQUIRED", message: "Name missing" };
      return { rule: "address:name", status: "PASS", message: "Name present" };
    },
    (f) => {
      const pin = normalizeDigits(get(f, "pinCode"));
      if (!pin) return { rule: "address:pin", status: "REVIEW_REQUIRED", message: "PIN code missing" };
      return pin.length === 6
        ? { rule: "address:pin", status: "PASS", message: "PIN code valid" }
        : { rule: "address:pin", status: "FAIL", message: "PIN code must be 6 digits" };
    },
  ],
  IDENTITY_PROOF: [
    (f) => {
      const name = get(f, "fullName");
      if (!name) return { rule: "identity:name", status: "REVIEW_REQUIRED", message: "Name missing" };
      return { rule: "identity:name", status: "PASS", message: "Name present" };
    },
    (f) => {
      const dob = get(f, "dateOfBirth");
      if (!dob) return { rule: "identity:dob", status: "REVIEW_REQUIRED", message: "Date of birth missing" };
      return isValidDate(dob)
        ? { rule: "identity:dob", status: "PASS", message: "Date of birth valid" }
        : { rule: "identity:dob", status: "FAIL", message: "Date of birth invalid or in future" };
    },
  ],
  POLICY_DOCUMENT: [
    (f) => {
      const pn = get(f, "policyNumber");
      if (!pn) return { rule: "policy:number", status: "REVIEW_REQUIRED", message: "Policy number missing" };
      return { rule: "policy:number", status: "PASS", message: "Policy number present" };
    },
  ],
  OTHER: [],
};

export function runDeterministicRules(
  docType: string,
  fields: Record<string, { value: string | null }>
): { results: RuleResult[]; pass: boolean; fail: boolean; review: boolean } {
  const results = (RULES[docType] ?? []).map((fn) => fn(fields));
  const fail = results.some((r) => r.status === "FAIL");
  const review = results.some((r) => r.status === "REVIEW_REQUIRED");
  const pass = !fail && !review;
  return { results, pass, fail, review };
}

/** Cross-document name consistency helper (Aadhaar vs PAN vs lead). */
export function namesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(mr|mrs|ms|shri|smt|kumari)/, "");
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export { isValidDate, notFutureDate, ageFromDob, normalizeDigits, PII_PATTERNS };
