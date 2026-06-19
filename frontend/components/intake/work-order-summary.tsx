"use client"

import { MapPin, Wrench, DollarSign, CalendarDays, MessageSquare, Check } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { WorkOrder, WorkOrderField } from "@/lib/types"

const FIELDS: { key: WorkOrderField; label: string; icon: LucideIcon }[] = [
  { key: "siteLocation", label: "Site Location", icon: MapPin },
  { key: "serviceType", label: "Service Type", icon: Wrench },
  { key: "budget", label: "Budget", icon: DollarSign },
  { key: "requiredServiceDate", label: "Required Service Date", icon: CalendarDays },
  { key: "outreachMessage", label: "Outreach Message Template", icon: MessageSquare },
]

export function WorkOrderSummary({
  workOrder,
  activeField,
}: {
  workOrder: WorkOrder
  activeField?: WorkOrderField | null
}) {
  const filledCount = FIELDS.filter((f) => workOrder[f.key].trim().length > 0).length
  const progress = Math.round((filledCount / FIELDS.length) * 100)

  return (
    <Card className="sticky top-24 gap-0 overflow-hidden">
      <CardHeader className="gap-1 border-b border-border bg-muted/40 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Work Order</CardTitle>
          <Badge variant={filledCount === FIELDS.length ? "default" : "secondary"} className="font-normal">
            {filledCount === FIELDS.length ? "Complete" : "Draft"}
          </Badge>
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

      <CardContent className="flex flex-col gap-1 p-3">
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
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                {filled ? (
                  <span
                    className={cn(
                      "text-sm text-foreground",
                      field.key === "outreachMessage" ? "line-clamp-3 leading-relaxed" : "font-medium",
                    )}
                  >
                    {value}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/60">
                    {isActive ? "Capturing…" : "Awaiting details"}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
