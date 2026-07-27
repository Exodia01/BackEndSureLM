import { validateRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json({ error: "linkId query parameter is required" }, { status: 400 });
    }

    const lead = await db.policyLead.findUnique({
      where: { id: leadId },
      select: { status: true, documentScans: { select: { templateId: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const activeTemplate = await db.requirementTemplate.findFirst({
      where: {
        items: {
          some: {
            scanRecords: {
              some: {
                leadId,
                status: { in: ["UPLOADED", "VALIDATED"] },
              },
            },
          },
        },
      },
      include: { items: true },
      orderBy: { version: "desc" },
    });

    if (!activeTemplate) {
      return NextResponse.json({
        mandatoryComplete: false,
        completedCount: 0,
        totalCount: 0,
        readyToIssue: false,
      }, { status: 200 });
    }

    const totalTemplateItems = activeTemplate.items.length;

    const validatedScanCount = await db.documentScan.count({
      where: {
        leadId,
        templateId: activeTemplate.id,
        status: "VALIDATED",
      },
    });

    const mandatoryTemplateItems = activeTemplate.items.filter(item => item.minRequired > 0).length;
    
    const validatedMandatoryCount = await db.documentScan.count({
      where: {
        leadId,
        templateId: activeTemplate.id,
        docType: { in: activeTemplate.items
          .filter(item => item.minRequired > 0)
          .map(item => item.docType) },
        status: "VALIDATED",
      },
    });

    const readyToIssue = validatedMandatoryCount >= mandatoryTemplateItems && lead.status === "POLICY_ISSUED";

    return NextResponse.json({
      success: true,
      mandatoryComplete: validatedMandatoryCount >= mandatoryTemplateItems,
      completedCount: validatedScanCount,
      totalCount: totalTemplateItems,
      readyToIssue,
    }, { status: 200 });
  } catch (error) {
    console.error("Checklist status error:", error);
    return NextResponse.json({ error: "Failed to get checklist status" }, { status: 500 });
  }
}
