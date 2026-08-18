/**
 * Lightweight, conservative intent classification for chat orchestration.
 *
 * These helpers are deliberately narrow: they must NOT fire recommendation
 * logic merely because a message contains words like "best" or "suggest".
 * Recommendation intent requires BOTH policy-domain vocabulary AND an explicit
 * recommendation/comparison framing. Policy-question intent requires only the
 * policy-domain vocabulary.
 */

const POLICY_DOMAIN_TERMS = [
  "policy",
  "insurance",
  "term plan",
  "endowment",
  "ulip",
  "unit linked",
  "premium",
  "sum assured",
  "cover",
  "rider",
  "maturity",
  "policyholder",
  "life insurance",
  "benefit",
  "policy term",
  "free look",
  "surrender",
  "entry age",
];

const RECOMMENDATION_FRAMING = [
  "recommend",
  "recommendation",
  "suitable",
  "suitability",
  "which policy",
  "which plan",
  "best fit",
  "compare",
  "comparison",
  "match",
  "rank",
  "suited",
  "should i choose",
  "should i pick",
  "help me choose",
];

function hasAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
}

/** Does the query talk about insurance policy knowledge at all? */
export function isPolicyQuestion(query: string): boolean {
  return hasAny(query, POLICY_DOMAIN_TERMS);
}

/**
 * Does the query ask for a recommendation/comparison? Requires BOTH policy
 * domain vocabulary AND explicit recommendation framing so that generic words
 * like "best" or "suggest" alone never trigger the recommendation engine.
 */
export function detectRecommendationIntent(query: string): boolean {
  return isPolicyQuestion(query) && hasAny(query, RECOMMENDATION_FRAMING);
}
