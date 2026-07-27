import { validateRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { leadId, productId } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const lead = await db.policyLead.findUnique({
      where: { id: leadId },
      select: { status: true, issuances: { select: { policyName: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const activePolicy = lead.issuances[0]?.policyName;
    const effectiveProductId = productId ?? (activePolicy ? activePolicy : null);

    if (!effectiveProductId) {
      return NextResponse.json({ error: "productId is required or policy must be issued" }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { id: effectiveProductId },
      select: { name: true, code: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const template = await db.requirementTemplate.findFirst({
      where: { productId: effectiveProductId },
      orderBy: { version: "desc" as any },
    });

    if (!template) {
      return NextResponse.json({ error: "No requirement template found for product" }, { status: 404 });
    }

    const items = await db.requirementItem.findMany({
      where: { templateId: template.id },
    });

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: `KYC Template v${template.version}`,
        version: template.version,
        productId: template.productId,
        productCode: product.code || undefined,
        items: items.map(item => ({
          id: item.id,
          docType: item.docType as any,
          label: item.label,
          description: item.label,
          isRequired: item.minRequired > 0,
          sortOrder: item.itemOrder,
        })),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Checklist generation error:", error);
    return NextResponse.json({ error: "Failed to generate checklist" }, { status: 500 });
  }
}
