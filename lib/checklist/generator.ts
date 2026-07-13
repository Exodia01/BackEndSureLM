import { PrismaClient, RequirementTemplate, RequirementItem, ChecklistInstance, Prisma } from '@prisma/client';
import { evaluateRuleSet, ApplicantData } from './ruleEvaluator';

export async function generateChecklistFromPolicySelection(
  prisma: PrismaClient,
  leadId: string,
  productId: string,
  applicantData: ApplicantData
): Promise<ChecklistInstance> {
  
  const template = await prisma.requirementTemplate.findFirst({
    where: { 
      productId
    },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      productId: true,
      version: true,
      items: true
    }
  });
  
  if (!template) {
    throw new Error(`No active requirement template for product ID: ${productId}`);
  }
  
  const applicableItems = await Promise.all(
    template.items.map(async (item) => {
      if (!item.ruleSet) return item;
      
      const result = await evaluateRuleSet(item.ruleSet, applicantData);
      
      return result.passes ? item : null;
    })
  );
  
  const filteredItems = applicableItems.filter((i): i is RequirementItem => !!i);
  
  if (filteredItems.length === 0) {
    throw new Error(`No items passed ruleSet evaluation for product ${productId}`);
  }
  
  const instance = await prisma.checklistInstance.create({
    data: {
      leadId,
      templateId: template.id,
      templateVersion: template.version,
      applicationData: applicantData as Prisma.JsonObject,
      overallStatus: 'PENDING',
      items: {
        create: filteredItems.map((item) => ({
          itemId: item.id,
          status: 'PENDING'
        }))
      }
    },
    include: { items: true }
  });
  
  return instance;
}

export async function invalidateChecklistOnPolicyChange(
  prisma: PrismaClient,
  leadId: string,
  newProductId: string,
  applicantData: ApplicantData
): Promise<ChecklistInstance> {
  
  const currentChecklist = await prisma.checklistInstance.findFirst({
    where: {
      leadId,
      overallStatus: { in: ['PENDING', 'PROCESSING', 'INVALIDATED'] }
    },
    include: { items: true }
  });
  
  if (!currentChecklist) {
    return await generateChecklistFromPolicySelection(
      prisma,
      leadId,
      newProductId,
      applicantData
    );
  }
  
  const invalidated = await prisma.checklistInstance.update({
    where: { id: currentChecklist.id },
    data: {
      overallStatus: 'INVALIDATED',
      invalidatedReason: `Policy changed from ${currentChecklist.templateId} to ${newProductId}`,
      completedAt: new Date()
    }
  });
  
  const newChecklist = await generateChecklistFromPolicySelection(
    prisma,
    leadId,
    newProductId,
    applicantData
  );
  
  return newChecklist;
}
