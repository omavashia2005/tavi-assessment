import { z } from "zod"

const address = /^\d+\s+[^,]+,\s+[A-Za-z .'-]+\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/

export const WorkOrderSchema = z.object({
  siteLocation: z.string().refine(
    (value) => !value || address.test(value),
    "Use: Street Number Street Name, City State ZIP",
  ),
  serviceType: z.string(),
  budget: z.string(),
  requiredServiceDate: z.union([z.literal(""), z.iso.date()]),
  outreachMessage: z.string(),
})

export type WorkOrder = z.infer<typeof WorkOrderSchema>
export type WorkOrderField = keyof WorkOrder

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number(),
  reviewCount: z.number(),
  distance: z.number(),
  priceMin: z.number(),
  priceMax: z.number(),
  description: z.string(),
  phone: z.string(),
  email: z.string(),
  specialties: z.array(z.string()),
  responseTime: z.string(),
  verified: z.boolean(),
})

export type Vendor = z.infer<typeof VendorSchema>

export const AgentStatusSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "extracting",
  "complete",
])

export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const TranscriptTurnSchema = z.object({
  id: z.number(),
  role: z.enum(["agent", "user"]),
  text: z.string(),
  fills: WorkOrderSchema.keyof().optional(),
  value: z.string().optional(),
})

export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>

export const ChatResponseSchema = z.object({
  assistant: z.string(),
  workOrder: WorkOrderSchema,
})
