import { PrismaClient, RequirementTemplate, RequirementItem } from "@prisma/client";

const prisma = new PrismaClient();

export interface ChecklistTemplate {
  id: string;
  name: string;
  version: number;
  productId?: string;
  productCode?: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  docType: RequirementItem["docType"];
  label: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  minRequired: number;
}
