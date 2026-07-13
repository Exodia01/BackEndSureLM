import { db } from '@/lib/db';
import { DocumentOCR } from './ocr';
import { runValidationRules, VALIDATION_RULES } from './rules';

export class ValidationService {
  private ocr: DocumentOCR;
  private processingQueue: string[] = [];

  constructor() {
    this.ocr = new DocumentOCR();
  }

  async validateDocument(documentId: string, docType: string) {
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) return;

    await this.logStage(documentId, 'OCR_COMPLETED', 'IN_PROGRESS');
    
    // Step 1: OCR
    const ocrResult = await this.ocr.ocrWithFallback(
      document.originalHash,
      docType
    );
    
    await this.logStage(documentId, 'OCR_COMPLETED', 'SUCCESS', {
      result_length: ocrResult.length,
    });

    // Step 2: Extract structured data
    const extractedData = await this.ocr.extractStructuredData(ocrResult, docType);
    await db.document.update({
      where: { id: documentId },
      data: { processedAt: new Date() },
    });

    await this.logStage(documentId, 'RULE_VALIDATED', 'IN_PROGRESS');

    // Step 3: Rule validation
    const validationRules = VALIDATION_RULES[docType] || [];
    const { passed, failed } = await runValidationRules(docType, extractedData);
    
    const failureReasons = failed.map(field => `${field} validation failed`);

    if (failed.length > 0) {
      await db.validationReport.create({
        data: {
          documentId,
          overallStatus: 'REJECTED',
          confidenceScore: 0.5,
          extractedData: JSON.stringify(extractedData),
          discrepancies: JSON.stringify(failureReasons),
          visualConfidence: 0.8,
          ruleConfidence: passed.length / (passed.length + failed.length),
        },
      });

      await db.document.update({
        where: { id: documentId },
        data: {
          validationStatus: 'REJECTED',
          validatedAt: new Date(),
        },
      });

      return { status: 'REJECTED', reasons: failureReasons };
    }

    await this.logStage(documentId, 'RULE_VALIDATED', 'SUCCESS');

    // Step 4: AI verification (optional)
    const aiVerification = await this.runAIVerification(extractedData);
    
    let overallStatus: string = 'VALIDATED';
    let confidenceScore = 0.9;

    if (!aiVerification) {
      overallStatus = 'REVIEW_REQUIRED';
      confidenceScore = 0.85;
    }

    await db.validationReport.create({
      data: {
        documentId,
        overallStatus,
        confidenceScore,
        extractedData: JSON.stringify(extractedData),
        discrepancies: null,
        visualConfidence: aiVerification ? 0.92 : 0.75,
        ruleConfidence: 1.0,
        externalMatch: null,
      },
    });

    await db.document.update({
      where: { id: documentId },
      data: {
        validationStatus: overallStatus,
        validatedAt: new Date(),
      },
    });

    return { status: overallStatus, confidenceScore };
  }

  private async logStage(
    documentId: string,
    stage: string,
    status: string,
    configuration?: Record<string, unknown>
  ) {
    await db.validationLog.create({
      data: {
        documentId,
        stage,
        status,
        configuration: JSON.stringify(configuration || {}),
        results: {},
      },
    });
  }

  private async runAIVerification(extractedData: Record<string, unknown>) {
    // Placeholder for AI verification logic
    return true;
  }

  async processQueue() {
    while (this.processingQueue.length > 0) {
      const docId = this.processingQueue.shift();
      if (docId) {
        await this.processSingleDocument(docId);
      }
    }
  }

  private async processSingleDocument(documentId: string) {
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) return;

    try {
      await this.validateDocument(documentId, document.documentType);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      
      await db.validationReport.create({
        data: {
          documentId,
          overallStatus: 'REJECTED',
          confidenceScore: 0,
          extractedData: JSON.stringify({ error: String(error) }),
          visualConfidence: 0,
          ruleConfidence: 0,
        },
      });

      await db.document.update({
        where: { id: documentId },
        data: {
          validationStatus: 'REJECTED',
          validatedAt: new Date(),
        },
      });
    }
  }
}
