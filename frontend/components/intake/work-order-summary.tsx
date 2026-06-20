"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MapPin, Wrench, DollarSign, CalendarDays, MessageSquare, Check, Expand, Loader2, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useWorkflow } from "@/components/workflow-provider"
import type { WorkOrder, WorkOrderField } from "@/lib/types"

const FIELDS: {
  key: WorkOrderField
  label: string
  icon: LucideIcon
  placeholder: string
  type?: React.HTMLInputTypeAttribute
}[] = [
  {
    key: "siteLocation",
    label: "Site Location",
    icon: MapPin,
    placeholder: "712 S Forest Ave, Tempe AZ 85281",
  },
  { key: "serviceType", label: "Service Type", icon: Wrench, placeholder: "Commercial HVAC repair" },
  { key: "budget", label: "Budget", icon: DollarSign, placeholder: "$8,000–$14,000" },
  {
    key: "requiredServiceDate",
    label: "Required Service Date",
    icon: CalendarDays,
    placeholder: "",
    type: "date",
  },
  {
    key: "outreachMessage",
    label: "Outreach Message Template",
    icon: MessageSquare,
    placeholder: "Message sent to selected vendors",
  },
]

export function WorkOrderSummary({
  workOrder,
  activeField,
  onChange,
}: {
  workOrder: WorkOrder
  activeField?: WorkOrderField | null
  onChange: (field: WorkOrderField, value: string) => void
}) {
  const router = useRouter()
  const { placeOrder } = useWorkflow()
  const [expanded, setExpanded] = useState(false)
  const [placing, setPlacing] = useState(false)
  const filledCount = FIELDS.filter((f) => workOrder[f.key].trim().length > 0).length
  const progress = Math.round((filledCount / FIELDS.length) * 100)
  const coreComplete = ["siteLocation", "serviceType", "budget", "requiredServiceDate"].every(
    (f) => workOrder[f as keyof typeof workOrder].trim().length > 0,
  )

  const fields = (large = false) => (
    <div className={cn("flex flex-col gap-1", large && "grid gap-4 md:grid-cols-2")}>
      {FIELDS.map((field) => {
        const value = workOrder[field.key]
        const filled = value.trim().length > 0
        const isActive = activeField === field.key
        const Icon = field.icon
        return (
          <div
            key={field.key}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-transparent p-3 transition-all",
              field.key === "outreachMessage" && large && "md:col-span-2",
              filled && "bg-card",
              isActive && "border-primary/30 bg-accent",
              !filled && !isActive && "opacity-70",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                filled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {filled ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
              {field.key === "outreachMessage" ? (
                <Textarea
                  aria-label={field.label}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className={cn("mt-1 min-h-20 resize-none", large && "min-h-32")}
                />
              ) : (
                <Input
                  aria-label={field.label}
                  type={field.type}
                  value={value}
                  placeholder={isActive ? "Capturing…" : field.placeholder}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="mt-1"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <Card className="sticky top-24 gap-0 overflow-hidden">
      <CardHeader className="gap-1 border-b border-border bg-muted/40 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Work Order</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={filledCount === FIELDS.length ? "default" : "secondary"} className="font-normal">
              {filledCount === FIELDS.length ? "Complete" : "Draft"}
            </Badge>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand work order"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Expand className="size-4" />
            </button>
          </div>
        </div>
        <CardDescription>Extracted live from your conversation</CardDescription>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Required information</span>
            <span className="font-medium tabular-nums">
              {filledCount} / {FIELDS.length}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </CardHeader>

        <CardContent className="p-3">{fields()}</CardContent>
      </Card>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setExpanded(false)}
        >
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <CardHeader className="flex-row items-start justify-between border-b border-border">
              <div>
                <CardTitle id="work-order-modal-title">Review work order</CardTitle>
                <CardDescription>Edit any extracted details before continuing.</CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close work order"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </CardHeader>
            <CardContent>{fields(true)}</CardContent>
            <div className="flex justify-end border-t border-border px-6 pt-4">
              <Button
                disabled={!coreComplete || placing}
                onClick={async () => {
                  setPlacing(true)
                  try {
                    await placeOrder()
                    setExpanded(false)
                    router.push("/orders")
                  } catch (error) {
                    toast.error("Could not place work order", {
                      description: error instanceof Error ? error.message : "Try again.",
                    })
                  } finally {
                    setPlacing(false)
                  }
                }}
              >
                {placing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                Place work order
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
