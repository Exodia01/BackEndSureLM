import { keycloakAuth } from '@/lib/auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { 
      documentType, 
      householdId,
      filename = 'document.pdf',
      mimetype = 'application/pdf',
      sizeBytes = 0,
    } = body;

    if (!documentType || !Object.values(DocumentTypes).includes(documentType as any)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const document = await db.document.create({
      data: {
        originalHash: `pending_${Date.now()}`,
        filename,
        mimetype,
        sizeBytes,
        uploadedBy: user.id,
        householdId,
        documentType: documentType as any,
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
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ data: [] });

    const documents = await db.document.findMany({
      where: { uploadedBy: user.id },
      orderBy: { createdAt: 'desc' },
      include: { validationReport: true },
    });

    return NextResponse.json({ 
      success: true,
      data: documents.map(d => ({
        ...d,
        validation_report: d.validationReport ? {
          status: d.validationReport.overallStatus,
          confidence_score: d.validationReport.confidenceScore,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
