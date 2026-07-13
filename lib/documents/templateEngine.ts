import { PrismaClient } from '@prisma/client';
import type { CustomerType, DocumentType } from '@prisma/client';

const prisma = new PrismaClient();

export interface ChecklistTemplate {
  id: string;
  name: string;
  version: number;
  customerType: CustomerType;
  productCode?: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  docType: DocumentType;
  label: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  rules?: Record<string, unknown>;
}

// Default templates for common policies
const DEFAULT_TEMPLATES: Partial<ChecklistTemplate>[] = [
  {
    name: 'Basic KYC - New Customer',
    customerType: 'NEW' as CustomerType,
    productCode: null,
    items: [
      { docType: 'KYC_AADHAAR_FRONT', label: 'Aadhaar Card (Front)', description: 'Upload front side with 12-digit number visible', isRequired: true, sortOrder: 1 },
      { docType: 'KYC_AADHAAR_BACK', label: 'Aadhaar Card (Back)', description: 'Upload back side with address', isRequired: true, sortOrder: 2 },
      { docType: 'KYC_PAN', label: 'PAN Card', description: 'Upload PAN card for identity verification', isRequired: true, sortOrder: 3 },
    ],
  },
  {
    name: 'Extended KYC - New Customer',
    customerType: 'NEW' as CustomerType,
    productCode: null,
    items: [
      { docType: 'KYC_AADHAAR_FRONT', label: 'Aadhaar Card (Front)', description: 'Upload front side with 12-digit number visible', isRequired: true, sortOrder: 1 },
      { docType: 'KYC_AADHAAR_BACK', label: 'Aadhaar Card (Back)', description: 'Upload back side with address', isRequired: true, sortOrder: 2 },
      { docType: 'KYC_PAN', label: 'PAN Card', description: 'Upload PAN card for identity verification', isRequired: true, sortOrder: 3 },
      { docType: 'KYC_ADDRESS', label: 'Address Proof', description: 'Latest utility bill or rent agreement (if address differs)', isRequired: false, sortOrder: 4 },
    ],
  },
  {
    name: 'Simplified KYC - Existing Customer',
    customerType: 'EXISTING' as CustomerType,
    productCode: null,
    items: [
      { docType: 'KYC_AADHAAR_FRONT', label: 'Aadhaar Card (Front)', description: 'Upload front side for address verification update', isRequired: true, sortOrder: 1 },
      { docType: 'KYC_PAN', label: 'PAN Card', description: 'Upload PAN card for reference', isRequired: true, sortOrder: 2 },
    ],
  },
];

export async function loadOrCreateTemplate(
  productName: string,
  customerType: CustomerType
): Promise<ChecklistTemplate> {
  // Try to find existing template
  const existing = await prisma.checklistTemplate.findFirst({
    where: {
      name: { contains: productName, mode: 'insensitive' },
      customerType,
      isActive: true,
    },
    orderBy: { version: 'desc' },
    include: { items: true },
  });

  if (existing) {
    return existing;
  }

  // Create default template based on customer type
  const baseTemplate = DEFAULT_TEMPLATES.find(
    t => t.customerType === customerType
  );

  if (!baseTemplate) {
    throw new Error(`No default template for customer type: ${customerType}`);
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      name: `${productName} - ${customerType === 'NEW' ? 'Extended KYC' : 'Simplified KYC'}`,
      version: 1,
      customerType,
      productCode: productName,
      items: {
        create: baseTemplate.items?.map((item, idx) => ({
          docType: item.docType as DocumentType,
          label: item.label,
          description: item.description,
          isRequired: item.isRequired,
          sortOrder: (item.sortOrder ?? 0) + idx,
        })),
      },
    },
    include: { items: true },
  });

  return template;
}

export async function getDynamicChecklist(
  leadId: string,
  productName?: string
): Promise<ChecklistTemplate> {
  const lead = await prisma.policyLead.findUnique({
    where: { id: leadId },
    select: { status: true, issuances: { select: { policyName: true } } },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const customerType = lead.status === 'POLICY_ISSUED' || lead.issuances.length > 0
    ? ('EXISTING' as CustomerType)
    : ('NEW' as CustomerType);

  return loadOrCreateTemplate(productName ?? 'General Policy', customerType);
}

export async function getAllTemplates(): Promise<ChecklistTemplate[]> {
  const templates = await prisma.checklistTemplate.findMany({
    where: { isActive: true },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return templates;
}
