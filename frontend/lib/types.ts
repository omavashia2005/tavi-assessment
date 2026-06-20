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

export const VendorResultSchema = z.object({
  name: z.string(),
  contactInfo: z.string(),
  reviewScore: z.string(),
  avgCost: z.string().default(""),
})

export type VendorResult = z.infer<typeof VendorResultSchema>

export const VendorSearchResponseSchema = z.object({
  vendors: z.array(VendorResultSchema),
})

export type VendorSearchResponse = z.infer<typeof VendorSearchResponseSchema>

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
