"use client"

import Link from "next/link"
import { ArrowRight, ClipboardList, MapPin, Phone, Star, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkflow } from "@/components/workflow-provider"
import type { VendorResult } from "@/lib/types"

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export default function OrdersPage() {
  const { placedOrders } = useWorkflow()

  if (placedOrders.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ClipboardList className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">No orders placed yet</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Work orders you place will appear here, newest first.
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
          <ClipboardList className="size-3" />
          {placedOrders.length} order{placedOrders.length === 1 ? "" : "s"}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every work order you&apos;ve placed, newest first.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {placedOrders.map((order) => (
          <li key={order.id}>
            <Card>
              <CardHeader className="gap-1 border-b border-border pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{order.workOrder.serviceType || "Untitled service"}</span>
                    </CardTitle>
                    {order.workOrder.siteLocation ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden="true" />
                        <span className="truncate">{order.workOrder.siteLocation}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {order.vendors.length} vendor{order.vendors.length === 1 ? "" : "s"}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {FORMATTER.format(order.placedAt)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {order.vendors.length === 0 ? (
                  <p className="px-6 py-5 text-sm text-muted-foreground">No vendors returned for this order.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {order.vendors.map((vendor, i) => (
                      <li key={`${order.id}-${i}`}>
                        <VendorRow vendor={vendor} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VendorRow({ vendor }: { vendor: VendorResult }) {
  return (
    <div className="grid gap-2 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{vendor.name}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {vendor.contactInfo ? (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3" aria-hidden="true" />
              {vendor.contactInfo}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <Star className="size-3" aria-hidden="true" />
            {vendor.reviewScore || "—"}
          </span>
        </div>
      </div>
      {vendor.avgCost ? (
        <span className="text-sm font-medium tabular-nums text-foreground sm:text-right">
          {vendor.avgCost}
        </span>
      ) : null}
    </div>
  )
}
