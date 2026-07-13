import { keycloakAuth } from '@/lib/auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractDocumentData } from '@/lib/documents/ocrPipeline';
import { detectDocumentType } from '@/lib/documents/autoClassifier';

export async function POST(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { leadId, templateId, imageBase64, isOptional, itemId, checklistId } = body;

    if (!leadId || !imageBase64) {
      return NextResponse.json({ error: 'leadId and imageBase64 are required' }, { status: 400 });
    }

    const lead = await db.policyLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let detectedType = body.detectedType || null;
    
    if (!detectedType) {
      const detectionResult = await detectDocumentType(imageBase64);
      detectedType = detectionResult.detectedType;
    }

    let checklistItemInstance = undefined;
    if (itemId && checklistId) {
      checklistItemInstance = await db.checklistItemInstance.findUnique({
        where: {
          itemId_instanceId: {
            itemId,
            instanceId: checklistId,
          },
        },
      });

      if (!checklistItemInstance) {
        return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
      }

      const requirement = await db.requirementItem.findUnique({
        where: { id: checklistItemInstance.itemId },
      });

      if (requirement && requirement.docType !== detectedType) {
        return NextResponse.json({ 
          error: `Document type mismatch. Expected: ${requirement.docType}, Got: ${detectedType}` 
        }, { status: 400 });
      }
    }

    const extractedData = await extractDocumentData(imageBase64, detectedType);

    const scanRecord = await db.documentScan.create({
      data: {
        leadId,
        templateId,
        docType: detectedType as any,
        status: 'UPLOADED',
        ocrData: {
          rawText: extractedData.text,
          structuredData: extractedData.structuredData,
        },
        extractedData: extractedData.structuredData,
      },
    });

    if (checklistItemInstance) {
      await db.checklistItemInstance.update({
        where: { id: checklistItemInstance.id },
        data: {
          status: 'UPLOADED',
          uploadedDocId: scanRecord.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      scanId: scanRecord.id,
      extractedData: {
        text: extractedData.text,
        structuredData: extractedData.structuredData,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
