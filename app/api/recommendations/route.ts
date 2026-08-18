import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { generateRecommendations } from "@/lib/ai/generateRecommendations";

/**
 * POST /api/recommendations
 *
 * Evidence-first policy recommendations for authenticated users (AGENT and
 * ADMIN). Customer context is optional; when missing, the engine flags
 * insufficientCustomerInformation so callers never overstate suitability.
 *
 * Body:
 * {
 *   query: string,
 *   customerContext?: {
 *     age?, income?, familySize?, existingPolicies?, goals?
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const customerContext = body?.customerContext;

    const result = await generateRecommendations(query, {
      age: typeof customerContext?.age === "number" ? customerContext.age : undefined,
      income:
        typeof customerContext?.income === "number" ? customerContext.income : undefined,
      familySize:
        typeof customerContext?.familySize === "number"
          ? customerContext.familySize
          : undefined,
      existingPolicies: Array.isArray(customerContext?.existingPolicies)
        ? customerContext.existingPolicies
        : undefined,
      goals: Array.isArray(customerContext?.goals)
        ? customerContext.goals
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/recommendations] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate recommendations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
