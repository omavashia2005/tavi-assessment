"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Gavel,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  Star,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { useWorkflow } from "@/components/workflow-provider"
import {
  WORK_ORDER_STATES,
  type VendorResult,
  type WorkOrderState,
} from "@/lib/types"
import type { PlacedOrder } from "@/components/workflow-provider"

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
  const { vendorMessages } = useWorkflow()
  const [openVendorIndex, setOpenVendorIndex] = useState<number | null>(null)
  const openVendor = openVendorIndex == null ? null : order.vendors[openVendorIndex] ?? null

  return (
    <section className="flex flex-col gap-6">
      <WorkOrderTimeline current={order.state} />

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
              hasResponse={Boolean(vendorMessages[vendor.id])}
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
  hasResponse,
  onOpen,
}: {
  vendor: VendorResult
  hasResponse: boolean
  onOpen: () => void
}) {
  const isWinning = vendor.vendorState === "SELECTED"
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isWinning && "border-emerald-500/40 shadow-emerald-500/10 shadow-lg",
        hasResponse && !isWinning && "border-primary/60 ring-2 ring-primary/30 shadow-lg shadow-primary/10",
      )}
    >
      {hasResponse ? (
        <Badge className="absolute -top-2 -right-2 gap-1 shadow-sm">
          <MessageSquare className="size-3" />
          New reply
        </Badge>
      ) : null}
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

          <ConversationSection vendor={vendor} />
        </CardContent>
      </Card>
    </div>
  )
}

function ConversationSection({ vendor }: { vendor: VendorResult }) {
  const { vendorMessages, sendMessage } = useWorkflow()
  const message = vendorMessages[vendor.id]

  const [draft, setDraft] = useState<string>(message?.agent_response ?? "")
  const [sending, setSending] = useState(false)
  // Track the last agent_response we synced into the draft so we only auto-update
  // the draft when the user hasn't manually edited it.
  const lastSyncedRef = useRef<string>(message?.agent_response ?? "")

  useEffect(() => {
    const incoming = message?.agent_response ?? ""
    const userHasEdited = draft !== lastSyncedRef.current
    if (!userHasEdited && incoming !== draft) {
      setDraft(incoming)
      lastSyncedRef.current = incoming
    } else if (userHasEdited) {
      // Still update the ref's reference so a later reset uses the freshest value.
      lastSyncedRef.current = incoming
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.agent_response, vendor.id])

  const handleSend = async () => {
    setSending(true)
    try {
      await sendMessage(vendor.id, draft)
      toast.success("Response sent")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send response")
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    const incoming = message?.agent_response ?? ""
    setDraft(incoming)
    lastSyncedRef.current = incoming
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <MessageSquare className="size-3.5" />
        Conversation
      </span>

      {!message ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Waiting for vendor response…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Vendor said
            </span>
            <blockquote className="rounded-lg border-l-2 border-primary/60 bg-muted/50 px-4 py-3 text-sm leading-relaxed text-foreground/90">
              {message.vendor_response || <span className="italic text-muted-foreground">No content</span>}
            </blockquote>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`agent-draft-${vendor.id}`}
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Your reply
            </label>
            <Textarea
              id={`agent-draft-${vendor.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="Draft a response to the vendor…"
              disabled={sending}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={sending || draft === (message.agent_response ?? "")}
            >
              <RotateCcw data-icon="inline-start" />
              Reset to draft
            </Button>
            <Button type="button" onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Approve & send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkOrderTimeline({ current }: { current: WorkOrderState }) {
  const currentIndex = WORK_ORDER_STATES.indexOf(current)
  return (
    <section
      aria-label={`Order status: ${current}`}
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 px-5 py-6 sm:px-8 sm:py-7"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkle />
          Order status
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {current}
        </span>
      </div>

      <ol className="flex items-start gap-2 sm:gap-3">
        {WORK_ORDER_STATES.map((s, i) => {
          const isDone = i < currentIndex
          const isActive = i === currentIndex
          const isFuture = i > currentIndex
          return (
            <li key={s} className="flex flex-1 flex-col items-center gap-2 min-w-0">
              <div className="flex w-full items-center gap-1.5 sm:gap-2">
                <span
                  className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:size-9",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    isActive &&
                      "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                    isFuture && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="size-3.5 sm:size-4" />
                  ) : (
                    <span className="text-[11px] font-semibold sm:text-xs">{i + 1}</span>
                  )}
                  {isActive ? (
                    <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" />
                  ) : null}
                </span>
                {i < WORK_ORDER_STATES.length - 1 ? (
                  <span
                    className={cn(
                      "h-0.5 flex-1 rounded-full transition-colors",
                      i < currentIndex ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "w-full truncate text-center text-[10px] font-medium leading-tight sm:text-xs",
                  isActive && "text-foreground",
                  isDone && "text-foreground/80",
                  isFuture && "text-muted-foreground",
                )}
                title={s}
              >
                {s}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Sparkle() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  )
}
