import { db } from '@/lib/db';
import type { PolicyLead, ChecklistItemInstance } from '@prisma/client';
import { runValidationRules, VALIDATION_RULES } from './rules';

export interface ValidationResult {
  status: 'VALIDATED' | 'REJECTED';
  errors?: string[];
}

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

export async function validateDocumentScan(
  db: any,
  scanId: string
): Promise<ValidationResult> {
  const scanRecord = await db.documentScan.findUnique({
    where: { id: scanId },
    include: { 
      lead: true,
      checklistItemInstance: true
    }
  });
  
  if (!scanRecord) throw new Error('DocumentScan not found');
  
  const docRecord = await db.document.findFirst({
    where: {
      metadata: { path: ['documentScanId'], equals: scanId }
    }
  });
  
  if (!docRecord) {
    throw new Error('Paired Document record not found (scanId in metadata)');
  }
  
  // Step 1: OCR validation
  await db.validationLog.create({
    data: {
      documentId: docRecord.id,
      scanId: scanRecord.id,
      stage: 'OCR_COMPLETED',
      status: 'SUCCESS',
      configuration: { filename: scanRecord.filename } as any,
      results: { text_length: (scanRecord.ocrData as any)?.rawText?.length }
    }
  });
  
  // Step 2: Rule validation
  await db.validationLog.create({
    data: {
      documentId: docRecord.id,
      scanId: scanRecord.id,
      stage: 'RULE_VALIDATED',
      status: 'IN_PROGRESS'
    }
  });
  
  const { passed, failed } = await runValidationRules(
    scanRecord.docType || 'document',
    (scanRecord.extractedData as any) ?? {},
    scanRecord.lead as unknown as PolicyLead | undefined
  );
  
  if (failed.length > 0) {
    await db.validationLog.create({
      data: {
        documentId: docRecord.id,
        scanId: scanRecord.id,
        stage: 'RULE_VALIDATED',
        status: 'FAILED',
        errorMsg: failed.join('; ')
      }
    });
    
    const errors = failed.map(f => `Rule validation failed: ${f}`);
    
    await db.validationReport.create({
      data: {
        documentId: docRecord.id,
        scanId: scanRecord.id,
        overallStatus: 'REJECTED' as any,
        rulesPassed: passed.length,
        rulesFailed: failed.length,
        errors: JSON.stringify(errors.map(m => ({ message: m }))) as any
      }
    });
    
    await db.documentScan.update({
      where: { id: scanId },
      data: { status: 'REJECTED' }
    });
    
    return { status: 'REJECTED', errors };
  }
  
  await db.validationLog.create({
    data: {
      documentId: docRecord.id,
      scanId: scanRecord.id,
      stage: 'RULE_VALIDATED',
      status: 'SUCCESS'
    }
  });
  
  await db.validationReport.create({
    data: {
      documentId: docRecord.id,
      scanId: scanRecord.id,
      overallStatus: 'VALIDATED' as any,
      rulesPassed: passed.length,
      aiConfidence: 0.95
    }
  });
  
  const updatedScan = await db.documentScan.update({
    where: { id: scanId },
    data: { 
      status: 'VALIDATED', 
      validatedAt: new Date(),
      validatedBy: scanRecord.uploadedById as string | null
    },
    include: { checklistItemInstance: true }
  });
  
  if (updatedScan.checklistItemInstance) {
    await db.checklistItemInstance.update({
      where: { id: updatedScan.checklistItemInstance.id },
      data: {
        status: 'VALIDATED' as any,
        validatedAt: new Date(),
        validatedBy: scanRecord.uploadedById as string | null
      }
    });
  }
  
  return { status: 'VALIDATED' };
}