"use client"

import Link from "next/link"
import { ArrowRight, ClipboardList, MapPin, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useWorkflow } from "@/components/workflow-provider"

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

      <ul className="flex flex-col gap-3">
        {placedOrders.map((order) => (
          <li key={order.id}>
            <Card>
              <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{order.workOrder.serviceType || "Untitled service"}</span>
                  </div>
                  {order.workOrder.siteLocation ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden="true" />
                      <span className="truncate">{order.workOrder.siteLocation}</span>
                    </div>
                  ) : null}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {FORMATTER.format(order.placedAt)}
                </span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
