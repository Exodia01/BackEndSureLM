export interface RequirementProfile {
  income?: number;
  occupation?: string;
  state?: string;
  familySize?: number;
  priorities?: string[];
  budgetMonthly?: number;
  existingInsurance?: boolean;
  age?: number;
}

export interface RecommendedPolicy {
  policyId: string;
  name: string;
  provider: string;
  premium: string;
  coverage: string;
  tag: string;
  suitabilityScore: number;
  explanation: string;
  buyUrl?: string;
}

export interface RecommendationSet {
  id: string;
  conversationId: string;
  version: number;
  requirements: RequirementProfile;
  analysis: string;
  policies: RecommendedPolicy[];
  confidenceScore: number;
  active: boolean;
}

