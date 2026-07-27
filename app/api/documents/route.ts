import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { 
      documentType, 
      householdId,
      filename = 'document.pdf',
      mimetype = 'application/pdf',
      sizeBytes = 0,
    } = body;

    if (!documentType || !['KYC_AADHAAR_FRONT', 'KYC_AADHAAR_BACK', 'KYC_PAN', 'KYC_ADDRESS', 'KYC_BANK_STATEMENT', 'KYC_INCOME_PROOF'].includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const document = await db.document.create({
      data: {
        filename,
        source: mimetype === 'application/pdf' ? 'manual_upload' : undefined,
        uploadedBy: user.id,
        householdId: householdId ?? undefined,
      },
    });

    await db.validationReport.create({
      data: {
        documentId: document.id,
        overallStatus: 'PENDING',
        rulesPassed: 0,
        rulesFailed: 0,
        aiConfidence: null,
      },
    });

    return NextResponse.json({ 
      success: true,
      document_id: document.id,
      upload_status: 'PENDING',
    }, { status: 201 });
  } catch (error) {
    console.error('Document creation error:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const documents = await db.document.findMany({
      where: { uploadedBy: user.id },
      orderBy: { createdAt: 'desc' },
      include: { validationReport: true },
    });

    return NextResponse.json({ 
      success: true,
      data: documents.map(d => ({
        ...d,
        validation_status: d.validationReport?.overallStatus || null,
        confidence_score: d.validationReport?.aiConfidence ?? 0,
      })),
    });
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}