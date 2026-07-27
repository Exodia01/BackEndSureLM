import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const document = await db.document.findUnique({
      where: { id: (await params).id },
      include: {
        validationReport: true,
      },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (document.uploadedById !== user.id && !['ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const response = {
      ...document,
      validation_report: document.validationReport ? {
        status: document.validationReport.overallStatus,
        confidence_score: document.validationReport.confidenceScore,
        extracted_data: JSON.parse(document.validationReport.extractedData as unknown as string),
        discrepancies: document.validationReport.discrepancies ? 
          JSON.parse(document.validationReport.discrepancies as unknown as string) : [],
      } : null,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { new_status, agent_notes } = body;

    if (!new_status || !['VALIDATED', 'REJECTED', 'REVIEW_REQUIRED'].includes(new_status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const document = await db.document.update({
      where: { id: (await params).id },
      data: {},
    });

    if (new_status === 'VALIDATED' && agent_notes) {
      await db.validationReport.update({
        where: { documentId: (await params).id },
        data: {
          validatedBy: user.id,
          validatedAt: new Date(),
          errors: JSON.stringify([{ field: 'review', message: agent_notes }]),
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      document_id: document.id,
      new_status: new_status,
    });
  } catch (error) {
    console.error('Document update error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
