"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { WorkOrder } from "@/lib/types"

const EMPTY_WORK_ORDER: WorkOrder = {
  siteLocation: "",
  serviceType: "",
  budget: "",
  requiredServiceDate: "",
  outreachMessage: "",
}

type WorkflowContextValue = {
  workOrder: WorkOrder
  setWorkOrder: (workOrder: WorkOrder) => void
  updateField: (field: keyof WorkOrder, value: string) => void
  selectedVendorIds: string[]
  toggleVendor: (id: string) => void
  isVendorSelected: (id: string) => boolean
  resetWorkflow: () => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder>(EMPTY_WORK_ORDER)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])

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

  const resetWorkflow = useCallback(() => {
    setWorkOrder(EMPTY_WORK_ORDER)
    setSelectedVendorIds([])
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
    }),
    [workOrder, updateField, selectedVendorIds, toggleVendor, isVendorSelected, resetWorkflow],
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
