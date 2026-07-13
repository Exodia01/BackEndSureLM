import { Prisma } from '@prisma/client';

export interface ValidationRule {
  field: string;
  validator: (value: unknown) => boolean | Promise<boolean>;
  message?: string;
}

export interface ExtractionConfig {
  model: string;
  promptTemplate: string;
  fields: string[];
}

export const OCR_CONFIG = {
  primaryModel: 'minicpm-v',
  fallbackModel: 'llava:7b',
};

export const VALIDATION_RULES: Record<string, ValidationRule[]> = {
  aadhaar_number: [
    { field: 'aadhaar_number', validator: (v) => /^(\d{4})-(\d{4})-(\d{4})$/.test(v as string), message: 'Invalid Aadhaar format' },
    { field: 'aadhaar_number', validator: (v) => /^\d{12}$/.test(v as string), message: 'Aadhaar must be 12 digits' },
  ],
  pan: [
    { field: 'pan', validator: (v) => /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(v as string), message: 'Invalid PAN format' },
  ],
  date_of_birth: [
    { field: 'date_of_birth', validator: (v) => {
      const dob = new Date(v as string);
      return dob < new Date() && new Date().getFullYear() - dob.getFullYear() >= 0;
    }, message: 'Invalid date of birth' },
  ],
};

export function validateField(rule: ValidationRule, value: unknown): boolean {
  try {
    return rule.validator(value);
  } catch {
    return false;
  }
}

export async function runValidationRules(
  documentType: string,
  extractedData: Record<string, unknown>
): Promise<{ passed: string[]; failed: string[] }> {
  const rules = VALIDATION_RULES[documentType] || [];
  const passed: string[] = [];
  const failed: string[] = [];

  for (const rule of rules) {
    if (validateField(rule, extractedData[rule.field])) {
      passed.push(rule.field);
    } else {
      failed.push(rule.field);
    }
  }

  return { passed, failed };
}
