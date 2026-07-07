import { z } from "zod";

// Common response structure
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// Message validation (chat/conversation)
export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(50000),
});

export type Message = z.infer<typeof MessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
  model: z.string().optional(),
  stream: z.boolean().default(true),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// CRM lead validation
export const LeadFilterSchema = z.object({
  agentId: z.string(),
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type LeadFilter = z.infer<typeof LeadFilterSchema>;

// PDF upload validation
export const PdfUploadSchema = z.object({
  fileBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().startsWith("application/pdf").optional(),
});

export type PdfUpload = z.infer<typeof PdfUploadSchema>;

// Error structure
export const ErrorDetailSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
