import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadOrCreateTemplate } from "@/lib/documents/templateEngine";

export async function POST(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { leadId, productName } = body;

    if (!leadId) {
      return NextResponse.json({ error: "linkId is required" }, { status: 400 });
    }

    const lead = await db.policyLead.findUnique({
      where: { id: leadId },
      select: { status: true, issuances: { select: { policyName: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const customerType = lead.status === "POLICY_ISSUED" || lead.issuances.length > 0
      ? ("EXISTING" as any)
      : ("NEW" as any);

    const template = await loadOrCreateTemplate(
      productName ?? "General Policy",
      customerType
    );

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
        customerType: template.customerType,
        productCode: template.productCode,
        items: template.items.map(item => ({
          id: item.id,
          docType: item.docType,
          label: item.label,
          description: item.description,
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        })),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Checklist generation error:", error);
    return NextResponse.json({ error: "Failed to generate checklist" }, { status: 500 });
  }
}
