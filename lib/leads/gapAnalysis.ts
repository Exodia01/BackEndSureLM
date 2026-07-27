
export interface MissingField {
  field: string;
  reason: string;
}

export interface GapAnalysisResult {
  missingFields: MissingField[];
  canProceed: boolean;
  chatPrompt: string;
  issues: string[];
}

export interface LeadData {
  id?: string;
  householdName?: string;
  phone?: string | null;
  income?: number | null;
  familySize?: number | null;
  dateOfBirth?: Date | null;
  [key: string]: unknown;
}

function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

export function isNameMatch(extractedName: string, expectedName: string, threshold: number = 80): boolean {
  if (!extractedName || !expectedName) return false;
  
  const distance = calculateLevenshteinDistance(extractedName.trim(), expectedName.trim());
  const maxLength = Math.max(extractedName.length, expectedName.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return similarity >= threshold;
}

export function generateMatchError(extractedName: string, expectedName: string, similarityScore: number): {
  field: string
  message: string
  rule: string
  extractedValue: string
  expectedValue: string
  similarityScore: number
} {
  return {
    field: 'householdName',
    message: `Household name mismatch. Extracted "${extractedName}" does not match expected "${expectedName}"`,
    rule: 'name_match_threshold_80',
    extractedValue: extractedName,
    expectedValue: expectedName,
    similarityScore
  };
}

export function analyzeGap(lead: LeadData): GapAnalysisResult {
  const missingFields: MissingField[] = [];
  const issues: string[] = [];

  if (!lead.phone || lead.phone.trim() === '') {
    missingFields.push({
      field: 'phone',
      reason: 'Phone number is required for contact verification'
    });
    issues.push('Missing phone number');
  }

  if (!lead.income || lead.income <= 0) {
    missingFields.push({
      field: 'income',
      reason: 'Income details needed to determine policy eligibility and premium'
    });
    issues.push('缺少收入信息 -无法评估保单资格');
  }

  if (!lead.dateOfBirth) {
    missingFields.push({
      field: 'dateOfBirth',
      reason: 'Date of birth required for age verification and risk assessment'
    });
    issues.push('缺少出生日期 -无法进行年龄验证和风险评估');
  } else {
    const dob = new Date(lead.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (age < 18 || age > 80) {
      missingFields.push({
        field: 'dateOfBirth',
        reason: `Age ${age} may be outside typical policy range (18-80)`
      });
      issues.push(`年龄验证问题 - ${age}岁可能超出典型保单范围`);
    }
  }

  if (!lead.familySize || lead.familySize <= 0) {
    missingFields.push({
      field: 'familySize',
      reason: 'Family size needed to determine appropriate coverage amount'
    });
    issues.push('缺少家庭规模 -无法确定适当的保障金额');
  }

  const canProceed = missingFields.length === 0;

  return {
    missingFields,
    canProceed,
    chatPrompt: generateChatPrompt(missingFields),
    issues
  };
}

export function generateChatPrompt(missingFields: MissingField[]): string {
  if (missingFields.length === 0) {
    return 'Lead data is complete. Ready to proceed with policy recommendation.';
  }

  const missingItems = missingFields.map(f => `- ${f.field}`).join('\n');
  
  return `The lead is missing the following information that is critical for policy assessment:

${missingItems}

Please engage the customer to provide these details before proceeding with any policy recommendations.`;
}
