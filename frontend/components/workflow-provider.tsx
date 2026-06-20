"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { WorkOrder } from "@/lib/types"
import type { VendorResult } from "@/components/vendors/vendor-card"

const EMPTY_WORK_ORDER: WorkOrder = {
  siteLocation: "",
  serviceType: "",
  budget: "",
  requiredServiceDate: "",
  outreachMessage: "",
}

type VendorSearch =
  | { status: "idle" }
  | { status: "searching"; startedAt: number }
  | { status: "done"; vendors: VendorResult[] }
  | { status: "error"; error: string }

type WorkflowContextValue = {
  workOrder: WorkOrder
  setWorkOrder: (workOrder: WorkOrder) => void
  updateField: (field: keyof WorkOrder, value: string) => void
  selectedVendorIds: string[]
  toggleVendor: (id: string) => void
  isVendorSelected: (id: string) => boolean
  resetWorkflow: () => void

  vendorSearch: VendorSearch
  startVendorSearch: () => void
  resetVendorSearch: () => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

function cacheKey(wo: WorkOrder) {
  return `vendor-search:${wo.siteLocation}|${wo.serviceType}|${wo.budget}|${wo.requiredServiceDate}`
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder>(EMPTY_WORK_ORDER)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState<VendorSearch>({ status: "idle" })
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from sessionStorage AFTER first paint — keeps SSR markup matching client
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tavi:workOrder")
      if (saved) setWorkOrder({ ...EMPTY_WORK_ORDER, ...JSON.parse(saved) })
    } catch { /* unavailable */ }
    setHydrated(true)
  }, [])

  // Persist work order on every change, but only once hydrated (avoid overwriting w/ empty)
  useEffect(() => {
    if (!hydrated) return
    try { sessionStorage.setItem("tavi:workOrder", JSON.stringify(workOrder)) } catch { /* quota */ }
  }, [workOrder, hydrated])

  const updateField = useCallback((field: keyof WorkOrder, value: string) => {
    setWorkOrder((prev) => ({ ...prev, [field]: value }))
  }, [])

  const toggleVendor = useCallback((id: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    )
  }, [])

  const isVendorSelected = useCallback(
    (id: string) => selectedVendorIds.includes(id),
    [selectedVendorIds],
  )

  // Dedupe across navigation / hydration: only one fetch per cacheKey in flight at a time
  const inFlight = useRef<Set<string>>(new Set())

  const runFetch = useCallback((key: string, body: WorkOrder) => {
    if (inFlight.current.has(key)) return
    inFlight.current.add(key)

    fetch("http://localhost:7860/api/vendor-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(t))))
      .then((data) => {
        const vendors: VendorResult[] = data.vendors ?? []
        try {
          sessionStorage.setItem(key, JSON.stringify(vendors))
          sessionStorage.removeItem(key + ":pending")
        } catch { /* quota */ }
        inFlight.current.delete(key)
        // Only apply if this fetch's key still matches the current work order
        if (cacheKey(body) === cacheKey(workOrder)) {
          setVendorSearch({ status: "done", vendors })
        }
      })
      .catch((e) => {
        try { sessionStorage.removeItem(key + ":pending") } catch { /* quota */ }
        inFlight.current.delete(key)
        if (cacheKey(body) === cacheKey(workOrder)) {
          setVendorSearch({ status: "error", error: typeof e === "string" ? e : "Search failed" })
        }
      })
  }, [workOrder])

  const startVendorSearch = useCallback(() => {
    const key = cacheKey(workOrder)
    try {
      const hit = sessionStorage.getItem(key)
      if (hit) {
        setVendorSearch({ status: "done", vendors: JSON.parse(hit) })
        return
      }
    } catch { /* unavailable */ }

    const startedAt = Date.now()
    try { sessionStorage.setItem(key + ":pending", startedAt.toString()) } catch { /* quota */ }
    setVendorSearch({ status: "searching", startedAt })
    runFetch(key, workOrder)
  }, [workOrder, runFetch])

  const resetVendorSearch = useCallback(() => {
    const key = cacheKey(workOrder)
    try {
      sessionStorage.removeItem(key)
      sessionStorage.removeItem(key + ":pending")
    } catch { /* unavailable */ }
    inFlight.current.delete(key)
    setVendorSearch({ status: "idle" })
  }, [workOrder])

  // Hydrate vendor search from sessionStorage on mount (and re-hydrate if cacheKey changes)
  const key = cacheKey(workOrder)
  useEffect(() => {
    if (!hydrated) return
    if (!workOrder.siteLocation || !workOrder.serviceType) {
      setVendorSearch({ status: "idle" })
      return
    }
    try {
      const hit = sessionStorage.getItem(key)
      if (hit) {
        setVendorSearch({ status: "done", vendors: JSON.parse(hit) })
        return
      }
      const pending = sessionStorage.getItem(key + ":pending")
      if (pending) {
        const startedAt = parseInt(pending, 10) || Date.now()
        setVendorSearch({ status: "searching", startedAt })
        runFetch(key, workOrder)
        return
      }
      setVendorSearch({ status: "idle" })
    } catch { /* unavailable */ }
  }, [key, hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetWorkflow = useCallback(() => {
    setWorkOrder(EMPTY_WORK_ORDER)
    setSelectedVendorIds([])
    setVendorSearch({ status: "idle" })
  }, [])

  const value = useMemo(
    () => ({
      workOrder,
      setWorkOrder,
      updateField,
      selectedVendorIds,
      toggleVendor,
      isVendorSelected,
      resetWorkflow,
      vendorSearch,
      startVendorSearch,
      resetVendorSearch,
    }),
    [
      workOrder,
      updateField,
      selectedVendorIds,
      toggleVendor,
      isVendorSelected,
      resetWorkflow,
      vendorSearch,
      startVendorSearch,
      resetVendorSearch,
    ],
  )

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) {
    throw new Error("useWorkflow must be used within a WorkflowProvider")
  }
  return ctx
}
