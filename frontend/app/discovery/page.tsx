"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useWorkflow } from "@/components/workflow-provider"
import { VendorCard } from "@/components/vendors/vendor-card"

const PHASES = [
  "Connecting to Better Business Bureau…",
  "Scanning service providers near your site…",
  "Ranking by reviews and distance…",
  "Finalizing top picks…",
]

const DISPLAY_LIMIT = 5

function phaseFromProgress(p: number) {
  if (p < 25) return 0
  if (p < 60) return 1
  if (p < 85) return 2
  return 3
}

// Convert elapsed ms → progress %. Tuned so 60s ≈ phase 3, capped at 99% until fetch resolves.
function progressFromElapsed(ms: number): number {
  const s = ms / 1000
  if (s < 8.3)  return (s / 8.3) * 25
  if (s < 31.6) return 25 + ((s - 8.3)  / 23.3) * 35
  if (s < 69.1) return 60 + ((s - 31.6) / 37.5) * 25
  return Math.min(99, 85 + ((s - 69.1) / 70) * 14)
}

export default function DiscoveryPage() {
  const { workOrder, vendorSearch, startVendorSearch, resetVendorSearch } = useWorkflow()
  // Re-render tick — purely so the progress bar updates while the search runs
  const [, setTick] = useState(0)

  // Auto-start search if idle (e.g. first time landing on this page)
  useEffect(() => {
    if (vendorSearch.status === "idle") startVendorSearch()
  }, [vendorSearch.status, startVendorSearch])

  // While searching, force a re-render every 300ms so progress bar advances
  useEffect(() => {
    if (vendorSearch.status !== "searching") return
    const id = setInterval(() => setTick((t) => t + 1), 300)
    return () => clearInterval(id)
  }, [vendorSearch.status])

  const retry = () => {
    resetVendorSearch()
    // resetVendorSearch sets status to idle, the auto-start effect picks it up next tick
    setTimeout(startVendorSearch, 0)
  }

  const progress =
    vendorSearch.status === "searching"
      ? progressFromElapsed(Date.now() - vendorSearch.startedAt)
      : vendorSearch.status === "done"
        ? 100
        : 0
  const phase = phaseFromProgress(progress)
  const vendors = vendorSearch.status === "done" ? vendorSearch.vendors : []

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
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
              <Search className="size-3" />
              Vendor discovery
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Finding the best vendors near you
            </h1>
            <p className="max-w-2xl text-muted-foreground text-pretty">
              Searching the Better Business Bureau for top-rated{" "}
              {workOrder.serviceType || "service"} providers within 20 miles of{" "}
              {workOrder.siteLocation || "your site"}.
            </p>
          </div>
        </div>
      </div>

      {(vendorSearch.status === "searching" || vendorSearch.status === "idle") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discovery in progress</CardTitle>
            <CardDescription>
              The AI agent is browsing BBB to find and rank qualified vendors. This typically takes
              30–90 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {PHASES.map((label, i) => {
                const isDone = i < phase
                const isActive = i === phase
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={[
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isDone
                          ? "bg-success text-success-foreground"
                          : isActive
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground",
                      ].join(" ")}
                    >
                      {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                    </div>
                    <span
                      className={[
                        "text-sm transition-colors",
                        isDone
                          ? "text-muted-foreground line-through decoration-muted-foreground/50"
                          : isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                    {isActive && (
                      <span className="ml-1 size-1.5 animate-pulse rounded-full bg-primary" />
                    )}
                  </div>
                )
              })}
            </div>

            <Separator />

            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {vendorSearch.status === "error" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Alert variant="destructive">
              <RefreshCw />
              <AlertTitle>Discovery failed</AlertTitle>
              <AlertDescription>{vendorSearch.error}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={retry} className="w-fit">
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {vendorSearch.status === "done" && (
        <div className="flex flex-col gap-6">
          {vendors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 size-8 opacity-40" />
                <p className="font-medium">No vendors found</p>
                <p className="mt-1 text-sm">
                  Try broadening your search or adjusting the service type.
                </p>
                <Button variant="outline" onClick={retry} className="mt-4">
                  <RefreshCw data-icon="inline-start" />
                  Search again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Showing top {Math.min(vendors.length, DISPLAY_LIMIT)} of {vendors.length} result
                    {vendors.length !== 1 ? "s" : ""} within 20 miles
                  </p>
                </div>
                <Button size="sm" nativeButton={false} render={<Link href="/vendors" />}>
                  View all vendors
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vendors.slice(0, DISPLAY_LIMIT).map((v, i) => (
                  <VendorCard key={i} vendor={v} rank={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
