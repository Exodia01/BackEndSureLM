import { RequirementProfile } from "@/types/insurance";

export function checkCompleteness(
  profile: RequirementProfile
) {
  const missing: string[] = [];

  if (!profile.occupation) {
    missing.push("occupation");
  }

  if (!profile.income) {
    missing.push("income");
  }

  if (!profile.familySize) {
    missing.push("family size");
  }

  if (!profile.priorities?.length) {
    missing.push("insurance priority");
  }

  if (!profile.state) {
    missing.push("state");
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

