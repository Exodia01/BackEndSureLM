import { z } from "zod";

const MAX_STRING_LENGTH = 5000;
const MAX_CONTENT_LENGTH = 50000;

export const CreateLeadSchema = z.object({
  householdName: z.string().trim().min(1).max(MAX_STRING_LENGTH),
  notes: z.string().trim().max(MAX_CONTENT_LENGTH).optional(),
});

export const CreateMessageSchema = z.object({
  leadId: z.string().min(1),
  role: z.enum(["AGENT", "AI"]),
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  policies: z.array(z.string()).nullable().optional(),
});

export const CreateReminderSchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(["FOLLOWUP", "BIRTHDAY"]),
  scheduledAt: z.string().datetime().or(z.date()),
  note: z.string().trim().max(MAX_CONTENT_LENGTH).optional(),
});

export const LEAD_STATUSES = ["NEW", "CONTACTED", "POLICY_ISSUED", "REJECTED"] as const;

export const UpdateLeadSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(LEAD_STATUSES).optional(),
  phone: z.string().max(50).optional(),
  income: z.number().int().nonnegative().nullable().optional(),
  familySize: z.number().int().positive().nullable().optional(),
  notes: z.string().max(MAX_CONTENT_LENGTH).optional(),
  dateOfBirth: z.string().or(z.date()).nullable().optional(),
  followUpAt: z.string().or(z.date()).nullable().optional(),
});
