"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  DollarSign,
  MapPin,
  MessageSquare,
  Pencil,
  Wrench,
  ShieldCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useWorkflow } from "@/components/workflow-provider"
import type { WorkOrder } from "@/lib/types"

const ROWS: { key: keyof WorkOrder; label: string; icon: LucideIcon }[] = [
  { key: "siteLocation", label: "Site Location", icon: MapPin },
  { key: "serviceType", label: "Service Type", icon: Wrench },
  { key: "budget", label: "Budget", icon: DollarSign },
  { key: "requiredServiceDate", label: "Required Service Date", icon: CalendarDays },
]

export default function ReviewPage() {
  const router = useRouter()
  const { workOrder, updateField } = useWorkflow()
  const [editing, setEditing] = useState(Object.values(workOrder).every((value) => !value))
  const isComplete = Object.values(workOrder).every((value) => value.trim())

  const approve = () => {
    toast.success("Work order approved", {
      description: "Starting vendor discovery near your site.",
    })
    router.push("/discovery")
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-1.5"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to intake
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit gap-1.5 font-normal">
              <ShieldCheck className="size-3" />
              Draft work order
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Review &amp; validate work order
            </h1>
            <p className="max-w-2xl text-muted-foreground text-pretty">
              Confirm the details Tavi captured before we search for vendors. Edit anything that needs a
              correction.
            </p>
          </div>
          <Button
            variant={editing ? "default" : "outline"}
            onClick={() => {
              setEditing((e) => !e)
              if (editing) toast.success("Changes saved")
            }}
          >
            {editing ? (
              <>
                <Check data-icon="inline-start" />
                Save changes
              </>
            ) : (
              <>
                <Pencil data-icon="inline-start" />
                Edit details
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border">
            <CardTitle>Work order details</CardTitle>
            <CardDescription>Enter or confirm the details before starting discovery.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {editing ? (
              <FieldGroup className="p-6">
                {ROWS.map((row) => (
                  <Field key={row.key}>
                    <FieldLabel htmlFor={row.key}>{row.label}</FieldLabel>
                    <Input
                      id={row.key}
                      value={workOrder[row.key]}
                      onChange={(e) => updateField(row.key, e.target.value)}
                    />
                  </Field>
                ))}
              </FieldGroup>
            ) : (
              <dl className="divide-y divide-border">
                {ROWS.map((row) => {
                  const Icon = row.icon
                  return (
                    <div key={row.key} className="flex items-start gap-4 px-6 py-4">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                        <dd className="text-sm font-medium text-foreground text-pretty">
                          {workOrder[row.key] || "—"}
                        </dd>
                      </div>
                    </div>
                  )
                })}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Outreach + actions */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card className="gap-0">
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Outreach message preview</CardTitle>
              </div>
              <CardDescription>Sent to each selected vendor</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              {editing ? (
                <Textarea
                  aria-label="Outreach message"
                  rows={9}
                  value={workOrder.outreachMessage}
                  onChange={(e) => updateField("outreachMessage", e.target.value)}
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                  {workOrder.outreachMessage || "—"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <ShieldCheck />
                <AlertTitle>{isComplete ? "Looks good to go" : "Details required"}</AlertTitle>
                <AlertDescription>
                  {isComplete
                    ? "Approving this work order moves you to vendor discovery."
                    : "Complete every work-order field before starting vendor discovery."}
                </AlertDescription>
              </Alert>
              <Separator />
              <Button size="lg" onClick={approve} disabled={!isComplete}>
                Approve &amp; Start Vendor Search
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
                Return to intake
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
