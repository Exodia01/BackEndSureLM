import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeGap } from '@/lib/leads/gapAnalysis';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authenticated, user } = await validateRequest(req);
    
    if (!authenticated || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = (await params).id;

    const lead = await db.policyLead.findUnique({
      where: {
        id: leadId,
        agentId: user.id
      }
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const gapAnalysis = analyzeGap({
      phone: lead.phone ?? undefined,
      income: lead.income ?? undefined,
      dateOfBirth: lead.dateOfBirth ? new Date(lead.dateOfBirth) : undefined,
      familySize: lead.familySize ?? undefined
    });

    try {
      await db.auditTrail.create({
        data: {
          actorType: 'USER',
          actorId: user.id,
          action: 'GAP_ANALYSIS_COMPLETED',
          entityType: 'PolicyLead',
          entityId: leadId,
          metadata: {
            missingFieldsCount: gapAnalysis.missingFields.length,
            canProceed: gapAnalysis.canProceed
          }
        }
      });
    } catch (auditError) {
      console.error('Audit trail creation failed:', auditError);
    }

    return NextResponse.json({
      canProceed: gapAnalysis.canProceed,
      missingFields: gapAnalysis.missingFields,
      chatPrompt: gapAnalysis.chatPrompt
    }, { status: 200 });
  } catch (error) {
    console.error('Gap analysis error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to perform gap analysis' 
    }, { status: 500 });
  }
}
