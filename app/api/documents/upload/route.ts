import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractDocumentData } from '@/lib/documents/ocrPipeline';
import { detectDocumentType } from '@/lib/documents/autoClassifier';

function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  return crypto.subtle.digest('SHA-256', msgBuffer).then(hash => {
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function calculateLevenshteinDistance(a: string, b: string): number {
  const source = a.toLowerCase().trim();
  const target = b.toLowerCase().trim();
  
  if (source === target) return 0;
  if (source.length === 0) return target.length;
  if (target.length === 0) return source.length;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= target.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= source.length; j++) { matrix[0][j] = j; }
  
  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= source.length; j++) {
      const cost = target[i - 1] === source[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  
  return matrix[target.length][source.length];
}

export function calculateSimilarity(a: string, b: string): number {
  const distance = calculateLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 100;
  return Math.round((1 - distance / maxLength) * 100);
}

export function validateHouseholdName(extractedName: string, expectedName: string): { valid: boolean; error?: string } {
  if (!extractedName || !expectedName) return { valid: false, error: 'Missing name data for validation' };
  
  const similarity = calculateSimilarity(extractedName.trim(), expectedName.trim());
  const threshold = 80;
  
  if (similarity < threshold) {
    return {
      valid: false,
      error: `Extracted household name '${extractedName}' matches expected household name '${expectedName}' at ${similarity}% similarity (threshold: ${threshold}%). Please verify the document belongs to this household member and retry.`
    };
  }
  
  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      checklistItemInstance = await db.checklistItemInstance.findFirst({
        where: {
          itemId,
          instanceId: checklistId,
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

    if (extractedData.structuredData.name && lead.householdName) {
      const similarity = validateHouseholdName(
        String(extractedData.structuredData.name),
        lead.householdName
      );
      
      if (!similarity.valid) {
        return NextResponse.json({
          success: false,
          error: 'Extracted name does not match household name',
          extractedName: String(extractedData.structuredData.name),
          expectedName: lead.householdName
        }, { status: 400 });
      }
    }

    const imageBytes = new TextEncoder().encode(imageBase64);
    
    const scanRecord = await db.documentScan.create({
      data: {
        leadId,
        templateId,
        docType: detectedType as any,
        status: 'UPLOADED',
        originalHash: await sha256(base64UrlEncode(imageBase64)),
        filename: `document-${Date.now()}.jpg`,
        mimetype: 'image/jpeg',
        sizeBytes: imageBytes.length,
        ocrData: {
          rawText: extractedData.text,
          structuredData: extractedData.structuredData as any,
        },
        extractedData: extractedData.structuredData as any,
      },
    });

    const response = NextResponse.json({
      success: true,
      scanId: scanRecord.id,
      extractedData: {
        text: extractedData.text,
        structuredData: extractedData.structuredData,
      },
    }, { status: 201 });

    if (checklistItemInstance) {
      await db.checklistItemInstance.update({
        where: { id: checklistItemInstance.id },
        data: {
          status: 'UPLOADED',
          uploadedDocId: scanRecord.id,
        },
      });
    }

    return response;
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
