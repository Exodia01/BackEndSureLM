import { Prisma } from '@prisma/client';

export interface ApplicantData {
  age?: number;
  income?: number;
  familySize?: number;
  occupation?: string;
  state?: string;
}

export interface RuleResult {
  passes: boolean;
  reason?: string;
}

export async function evaluateRuleSet(
  ruleSet: Prisma.JsonValue,
  applicantData: ApplicantData
): Promise<RuleResult> {
  if (!ruleSet || typeof ruleSet !== 'object') {
    return { passes: true };
  }

  const rules = ruleSet as Record<string, unknown>;

  if (rules.ageMin !== undefined) {
    if (applicantData.age === undefined) {
      return { passes: false, reason: 'Age not specified' };
    }
    if (applicantData.age < Number(rules.ageMin)) {
      return { passes: false, reason: `Minimum age ${rules.ageMin} not met` };
    }
  }

  if (rules.ageMax !== undefined) {
    if (applicantData.age === undefined) {
      return { passes: false, reason: 'Age not specified' };
    }
    if (applicantData.age > Number(rules.ageMax)) {
      return { passes: false, reason: `Maximum age ${rules.ageMax} exceeded` };
    }
  }

  if (rules.incomeMin !== undefined) {
    if (applicantData.income === undefined) {
      return { passes: false, reason: 'Income not specified' };
    }
    if (applicantData.income < Number(rules.incomeMin)) {
      return { passes: false, reason: `Minimum income ₹${rules.incomeMin} not met` };
    }
  }

  if (rules.familySizeMin !== undefined) {
    if (applicantData.familySize === undefined) {
      return { passes: false, reason: 'Family size not specified' };
    }
    if (applicantData.familySize < Number(rules.familySizeMin)) {
      return { passes: false, reason: `Minimum family size ${rules.familySizeMin} not met` };
    }
  }

  if (rules.occupation !== undefined) {
    const allowedOccupations = Array.isArray(rules.occupation) ? rules.occupation : [rules.occupation];
    if (!allowedOccupations.includes(applicantData.occupation || '')) {
      return { passes: false, reason: 'Occupation not in allowed list' };
    }
  }

  return { passes: true };
}
