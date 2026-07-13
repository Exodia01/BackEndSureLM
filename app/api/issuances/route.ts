import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateChecklistFromPolicySelection } from "@/lib/checklist/generator";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("keycloak_access_token")?.value;
    if (!token) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const leadId = req.nextUrl.searchParams.get("leadId");
    if (!leadId) return Response.json({ success: false, error: "leadId required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { keycloakId: token } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: user.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    const issuances = await db.policyIssuance.findMany({
      where: { leadId },
      select: { policyName: true },
    });

    return Response.json({ success: true, data: issuances });
  } catch (error) {
    console.error("Fetch issuances error:", error);
    return Response.json({ success: false, error: "Failed to fetch issuances" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("keycloak_access_token")?.value;
    if (!token) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { leadId, policyName, policyProvider, premiumAmount } = await req.json();
    if (!leadId || !policyName) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { keycloakId: token } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: user.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    const parsedPremium = premiumAmount
      ? parseInt(premiumAmount.replace(/[^0-9]/g, ""))
      : null;

    const product = await db.product.findFirst({
      where: { name: policyName },
      select: { id: true },
    });

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const applicantData = {
      income: lead.income ?? null,
      familySize: lead.familySize ?? null,
      dateOfBirth: lead.dateOfBirth ?? null,
    };

    // Next premium due = 30 days from now (monthly collection)
    const nextPremiumDue = new Date();
    nextPremiumDue.setDate(nextPremiumDue.getDate() + 30);

    const issuance = await db.policyIssuance.create({
      data: {
        leadId,
        policyName,
        policyProvider: policyProvider ?? null,
        premiumAmount: parsedPremium,
        nextPremiumDue,
        status: "ACTIVE",
      },
    });

    await db.policyLead.update({
      where: { id: leadId },
      data: { status: "POLICY_ISSUED" },
    });

    const checklist = await generateChecklistFromPolicySelection(
      db,
      leadId,
      product.id,
      applicantData
    );

    return Response.json({ success: true, data: { ...issuance, checklist } });
  } catch (error) {
    console.error("Issue policy error:", error);
    return Response.json({ success: false, error: "Failed to issue policy" }, { status: 500 });
  }
}