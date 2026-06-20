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

export const VENDOR_STATES = [
  "AWAITING_RESPONSE",
  "NEGOTIATING",
  "QUOTE_RECEIVED",
  "SELECTED",
] as const
export type VendorState = (typeof VENDOR_STATES)[number]

export const WORK_ORDER_STATES = [
  "Contacting Vendors",
  "Auctioning",
  "Vendor Assigned",
  "Site Visit",
  "Order Complete",
] as const
export type WorkOrderState = (typeof WORK_ORDER_STATES)[number]

export const VendorResultSchema = z.object({
  id: z.string().default(""),
  name: z.string(),
  contactInfo: z.string(),
  reviewScore: z.string(),
  avgCost: z.string().default(""),
  // ponytail: optional + defaulted so today's backend payload still parses;
  // backend can start sending these without a frontend change.
  quote: z.string().default(""),
  serviceDate: z.string().default(""),
  serviceTime: z.string().default(""),
  vendorState: z.enum(VENDOR_STATES).default("AWAITING_RESPONSE"),
})

export type VendorResult = z.infer<typeof VendorResultSchema>

export const VendorSearchResponseSchema = z.object({
  work_order_id: z.string().default(""),
  vendors: z.array(VendorResultSchema),
})

export type VendorSearchResponse = z.infer<typeof VendorSearchResponseSchema>

export const SendMessageResponseSchema = z.object({
  work_order_id: z.string(),
  work_order_state: z.enum(WORK_ORDER_STATES),
  vendor_id: z.string(),
  vendor_state: z.enum(VENDOR_STATES),
})

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>

export const VendorMessageSchema = z.object({
  vendor_id: z.string(),
  vendor_response: z.string(),
  agent_response: z.string(),
})

export type VendorMessage = z.infer<typeof VendorMessageSchema>

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
