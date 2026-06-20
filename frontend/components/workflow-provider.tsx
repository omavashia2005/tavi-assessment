"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  SendMessageRequestSchema,
  SendMessageResponseSchema,
  VendorMessageSchema,
  WorkOrderResponseSchema,
  type VendorMessage,
  type VendorResult,
  type WorkOrder,
  type WorkOrderState,
} from "@/lib/types"

const EMPTY_WORK_ORDER: WorkOrder = {
  siteLocation: "",
  serviceType: "",
  budget: "",
  requiredServiceDate: "",
  outreachMessage: "",
}

const PIPECAT_URL = process.env.NEXT_PUBLIC_PIPECAT_URL ?? "http://localhost:7860"

export type PlacedOrder = {
  id: string
  placedAt: number
  workOrder: WorkOrder
  vendors: VendorResult[]
  state: WorkOrderState
}

type WorkflowContextValue = {
  workOrder: WorkOrder
  setWorkOrder: (workOrder: WorkOrder) => void
  updateField: (field: keyof WorkOrder, value: string) => void
  resetWorkflow: () => void
  placedOrders: PlacedOrder[]
  placeOrder: () => Promise<void>
  vendorMessages: Record<string, VendorMessage>
  sendMessage: (vendorId: string, response: string) => Promise<void>
  unreadVendorIds: Set<string>
  markVendorRead: (vendorId: string) => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder>(EMPTY_WORK_ORDER)
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([])
  const [vendorMessages, setVendorMessages] = useState<Record<string, VendorMessage>>({})
  const [unreadVendorIds, setUnreadVendorIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  // Ref so the SSE handler can look up vendor names from the latest placedOrders
  // without re-subscribing every time orders change.
  const placedOrdersRef = useRef<PlacedOrder[]>([])
  placedOrdersRef.current = placedOrders

  // ponytail: native EventSource handles reconnect
  useEffect(() => {
    const es = new EventSource(`${PIPECAT_URL}/api/receive-messages`)
    es.onmessage = (event) => {
      try {
        const parsed = VendorMessageSchema.safeParse(JSON.parse(event.data))
        if (parsed.success) {
          const message = parsed.data
          setVendorMessages((prev) => ({ ...prev, [message.vendor_id]: message }))
          setUnreadVendorIds((prev) => {
            const next = new Set(prev)
            next.add(message.vendor_id)
            return next
          })
          setPlacedOrders((prev) =>
            prev.map((order) =>
              order.id !== message.work_order_id
                ? order
                : {
                    ...order,
                    vendors: order.vendors.map((vendor) =>
                      vendor.id !== message.vendor_id
                        ? vendor
                        : {
                            ...vendor,
                            quote: message.quote || vendor.quote,
                            serviceDate: message.service_date || vendor.serviceDate,
                            serviceTime: message.service_time || vendor.serviceTime,
                            contactInfo: message.contact_info || vendor.contactInfo,
                            vendorState: message.vendor_state,
                          },
                    ),
                  },
            ),
          )
          const name = placedOrdersRef.current
            .flatMap((o) => o.vendors)
            .find((v) => v.id === message.vendor_id)?.name
          toast.info(name ? `New response from ${name}` : "New vendor response")
        }
      } catch { /* malformed event */ }
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    try {
      const wo = localStorage.getItem("tavi:workOrder")
      if (wo) setWorkOrder({ ...EMPTY_WORK_ORDER, ...JSON.parse(wo) })
      const orders = localStorage.getItem("tavi:placedOrders")
      if (orders) {
        const parsed: PlacedOrder[] = JSON.parse(orders)
        setPlacedOrders(parsed.map((o) => ({
          ...o,
          vendors: (o.vendors ?? []).map((v) => ({
            ...v,
            quote: v.quote ?? "",
            serviceDate: v.serviceDate ?? "",
            serviceTime: v.serviceTime ?? "",
            vendorState: v.vendorState ?? "AWAITING_RESPONSE",
          })),
          state: o.state ?? "Contacting Vendors",
        })))
      }
    } catch { /* unavailable */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem("tavi:workOrder", JSON.stringify(workOrder)) } catch { /* quota */ }
  }, [workOrder, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem("tavi:placedOrders", JSON.stringify(placedOrders)) } catch { /* quota */ }
  }, [placedOrders, hydrated])

  const updateField = useCallback((field: keyof WorkOrder, value: string) => {
    setWorkOrder((prev) => ({ ...prev, [field]: value }))
  }, [])

  const resetWorkflow = useCallback(() => setWorkOrder(EMPTY_WORK_ORDER), [])

  const placeOrder = useCallback(async () => {
    const snapshot = workOrder
    const response = await fetch(`${PIPECAT_URL}/api/work-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    })
    if (!response.ok) throw new Error(await response.text().catch(() => "Place order failed"))
    const parsed = WorkOrderResponseSchema.parse(await response.json())
    setPlacedOrders((prev) => [
      {
        id: parsed.work_order_id,
        placedAt: Date.now(),
        workOrder: snapshot,
        vendors: parsed.vendors,
        state: "Contacting Vendors",
      },
      ...prev,
    ])
  }, [workOrder])

  const sendMessage = useCallback(async (vendorId: string, response: string) => {
    const body = SendMessageRequestSchema.parse({ vendorId, response })
    const res = await fetch(`${PIPECAT_URL}/api/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text().catch(() => "Send failed"))
    const data = SendMessageResponseSchema.parse(await res.json())
    setPlacedOrders((prev) =>
      prev.map((o) =>
        o.id !== data.work_order_id
          ? o
          : {
              ...o,
              state: data.work_order_state,
              vendors: o.vendors.map((v) =>
                v.id !== data.vendor_id ? v : { ...v, vendorState: data.vendor_state },
              ),
            },
      ),
    )
  }, [])

  const markVendorRead = useCallback((vendorId: string) => {
    setUnreadVendorIds((prev) => {
      if (!prev.has(vendorId)) return prev
      const next = new Set(prev)
      next.delete(vendorId)
      return next
    })
  }, [])

  const value = useMemo<WorkflowContextValue>(
    () => ({
      workOrder,
      setWorkOrder,
      updateField,
      resetWorkflow,
      placedOrders,
      placeOrder,
      vendorMessages,
      sendMessage,
      unreadVendorIds,
      markVendorRead,
    }),
    [
      workOrder,
      updateField,
      resetWorkflow,
      placedOrders,
      placeOrder,
      vendorMessages,
      sendMessage,
      unreadVendorIds,
      markVendorRead,
    ],
  )

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error("useWorkflow must be used within a WorkflowProvider")
  return ctx
}
