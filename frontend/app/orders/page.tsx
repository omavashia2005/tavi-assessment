"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Gavel,
  MapPin,
  Phone,
  Sparkles,
  Star,
  Wrench,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkflow } from "@/components/workflow-provider"
import {
  VENDOR_STATES,
  type VendorResult,
  type VendorState,
  type WorkOrderState,
} from "@/lib/types"
import type { PlacedOrder } from "@/components/workflow-provider"

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const WORK_ORDER_STATE_STYLES: Record<WorkOrderState, string> = {
  "Contacting Vendors": "bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
  Auctioning: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  "Vendor Assigned": "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  "Site Visit": "bg-cyan-500/15 text-cyan-700 ring-cyan-500/30 dark:text-cyan-300",
  "Order Complete": "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
}

const VENDOR_STATE_STYLES: Record<VendorState, string> = {
  Contacted: "bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
  Negotiating: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  "Quote Received": "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  Selected: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
}

export default function OrdersPage() {
  const { placedOrders } = useWorkflow()
  const [site, setSite] = useState<string>("")
  const [serviceType, setServiceType] = useState<string>("")

  // Distinct site locations from placed orders
  const sites = useMemo(
    () => Array.from(new Set(placedOrders.map((o) => o.workOrder.siteLocation).filter(Boolean))),
    [placedOrders],
  )

  // Work order options filter by selected site so we never offer a dead combo
  const serviceTypes = useMemo(
    () =>
      Array.from(
        new Set(
          placedOrders
            .filter((o) => !site || o.workOrder.siteLocation === site)
            .map((o) => o.workOrder.serviceType)
            .filter(Boolean),
        ),
      ),
    [placedOrders, site],
  )

  // Default to the newest order's pair on mount / when orders change
  useEffect(() => {
    if (placedOrders.length === 0) return
    if (!site) setSite(placedOrders[0].workOrder.siteLocation)
    if (!serviceType) setServiceType(placedOrders[0].workOrder.serviceType)
  }, [placedOrders, site, serviceType])

  // Reset service-type selection if it stops being valid for the new site
  useEffect(() => {
    if (serviceType && !serviceTypes.includes(serviceType)) setServiceType(serviceTypes[0] ?? "")
  }, [serviceTypes, serviceType])

  // Latest matching order — placedOrders is already newest-first
  const activeOrder = useMemo(
    () =>
      placedOrders.find(
        (o) => o.workOrder.siteLocation === site && o.workOrder.serviceType === serviceType,
      ) ?? null,
    [placedOrders, site, serviceType],
  )

  if (placedOrders.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ClipboardList className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">No orders placed yet</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Work orders you place will appear here.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Create your first order
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit gap-1.5 font-normal">
          <Gavel className="size-3" />
          Live auctions
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
        <p className="max-w-2xl text-muted-foreground">
          Pick a site and a work order to watch vendors bid for the job.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-2xl">
        <FilterSelect
          label="Site"
          icon={<MapPin className="size-3.5" />}
          value={site}
          onChange={setSite}
          options={sites}
          placeholder="Choose a site"
        />
        <FilterSelect
          label="Work order"
          icon={<Wrench className="size-3.5" />}
          value={serviceType}
          onChange={setServiceType}
          options={serviceTypes}
          placeholder="Choose a work order"
        />
      </div>

      {activeOrder ? (
        <OrderDetail order={activeOrder} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No order exists for this site and work order combination.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function OrderDetail({ order }: { order: PlacedOrder }) {
  const [openVendorIndex, setOpenVendorIndex] = useState<number | null>(null)
  const openVendor = openVendorIndex == null ? null : order.vendors[openVendorIndex] ?? null

  return (
    <section className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Placed {DATE_TIME_FORMATTER.format(order.placedAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {order.vendors.length} vendor{order.vendors.length === 1 ? "" : "s"} competing
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {order.workOrder.serviceType || "Untitled service"}
            </h2>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {order.workOrder.siteLocation || "—"}
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Order status
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1",
                WORK_ORDER_STATE_STYLES[order.state],
              )}
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {order.state}
            </span>
          </div>
        </CardContent>
      </Card>

      {order.vendors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No vendors returned for this order yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {order.vendors.map((vendor, i) => (
            <VendorCard
              key={`${order.id}-${i}`}
              vendor={vendor}
              onOpen={() => setOpenVendorIndex(i)}
            />
          ))}
        </div>
      )}

      {openVendor ? (
        <VendorModal vendor={openVendor} onClose={() => setOpenVendorIndex(null)} />
      ) : null}
    </section>
  )
}

function VendorCard({
  vendor,
  onOpen,
}: {
  vendor: VendorResult
  onOpen: () => void
}) {
  const isWinning = vendor.state === "Selected"
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isWinning && "border-emerald-500/40 shadow-emerald-500/10 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold">{vendor.name}</span>
          {vendor.reviewScore ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3" aria-hidden="true" />
              {vendor.reviewScore}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
            VENDOR_STATE_STYLES[vendor.state],
          )}
        >
          {vendor.state}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Bid</span>
        <span className="text-xl font-semibold tabular-nums">
          {vendor.quote || vendor.avgCost || "—"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <DetailItem icon={<Phone className="size-3" />} label="Contact" value={vendor.contactInfo || "—"} />
        <DetailItem icon={<CalendarDays className="size-3" />} label="Date" value={vendor.serviceDate || "—"} />
        <DetailItem icon={<Clock className="size-3" />} label="Time" value={vendor.serviceTime || "—"} />
      </dl>

      <Timeline current={vendor.state} compact />
    </button>
  )
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function VendorModal({
  vendor,
  onClose,
}: {
  vendor: VendorResult
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CardContent className="flex flex-col gap-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                  VENDOR_STATE_STYLES[vendor.state],
                )}
              >
                {vendor.state}
              </span>
              <h2 id="vendor-modal-title" className="text-2xl font-semibold tracking-tight">
                {vendor.name}
              </h2>
              {vendor.reviewScore ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Star className="size-3.5" aria-hidden="true" />
                  {vendor.reviewScore} rating
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close vendor details"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex items-baseline justify-between rounded-xl bg-muted/50 px-5 py-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Bid</span>
              <span className="text-3xl font-semibold tabular-nums">
                {vendor.quote || vendor.avgCost || "—"}
              </span>
            </div>
            {vendor.avgCost && vendor.quote ? (
              <span className="text-xs text-muted-foreground">
                Avg market <span className="tabular-nums">{vendor.avgCost}</span>
              </span>
            ) : null}
          </div>

          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailItem icon={<Phone className="size-3.5" />} label="Contact" value={vendor.contactInfo || "—"} />
            <DetailItem icon={<CalendarDays className="size-3.5" />} label="Date" value={vendor.serviceDate || "—"} />
            <DetailItem icon={<Clock className="size-3.5" />} label="Time" value={vendor.serviceTime || "—"} />
          </dl>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vendor progress
            </span>
            <Timeline current={vendor.state} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Timeline({ current, compact = false }: { current: VendorState; compact?: boolean }) {
  const currentIndex = VENDOR_STATES.indexOf(current)
  return (
    <ol className={cn("flex items-start gap-2", compact ? "pt-3" : "pt-1")}>
      {VENDOR_STATES.map((s, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        return (
          <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  compact ? "size-5" : "size-7",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  !isDone && !isActive && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? (
                  <Check className={compact ? "size-2.5" : "size-3.5"} />
                ) : (
                  <span className={cn("font-semibold", compact ? "text-[9px]" : "text-xs")}>
                    {i + 1}
                  </span>
                )}
              </span>
              {i < VENDOR_STATES.length - 1 ? (
                <span
                  className={cn(
                    "h-px flex-1 transition-colors",
                    i < currentIndex ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "text-center leading-tight",
                compact ? "text-[9px]" : "text-[11px]",
                isActive ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
