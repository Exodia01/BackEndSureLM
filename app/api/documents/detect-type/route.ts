import { keycloakAuth } from '@/lib/auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectDocumentType } from '@/lib/documents/autoClassifier';

export async function POST(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    const detectionResult = await detectDocumentType(imageBase64);

    return NextResponse.json({
      success: true,
      detectedType: detectionResult.detectedType,
      confidence: detectionResult.confidence,
      suggestedTemplates: detectionResult.suggestedTemplates,
      confidenceBreakdown: detectionResult.confidenceBreakdown,
    }, { status: 200 });
  } catch (error) {
    console.error('Document type detection error:', error);
    return NextResponse.json({ error: 'Failed to detect document type' }, { status: 500 });
  }
}
