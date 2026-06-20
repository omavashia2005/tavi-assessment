"use client"

import { useEffect, useRef, useState } from "react"
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
import { VendorCard, type VendorResult } from "@/components/vendors/vendor-card"

const PHASES = [
  "Connecting to Better Business Bureau…",
  "Scanning service providers near your site…",
  "Ranking by reviews and distance…",
  "Finalizing top picks…",
]

function phaseFromProgress(p: number) {
  if (p < 25) return 0
  if (p < 60) return 1
  if (p < 85) return 2
  return 3
}

// Matches the ticker curve: 0→25 in ~8s, 25→60 in ~23s, 60→85 in ~38s, 85→99 in ~70s
function progressFromElapsed(ms: number): number {
  const s = ms / 1000
  if (s < 8.3)  return (s / 8.3) * 25
  if (s < 31.6) return 25 + ((s - 8.3)  / 23.3) * 35
  if (s < 69.1) return 60 + ((s - 31.6) / 37.5) * 25
  return Math.min(99,  85 + ((s - 69.1) / 70)   * 14)
}

type Status = "searching" | "done" | "error"

const DISPLAY_LIMIT = 5

function cacheKey(wo: ReturnType<typeof useWorkflow>["workOrder"]) {
  return `vendor-search:${wo.siteLocation}|${wo.serviceType}|${wo.budget}|${wo.requiredServiceDate}`
}

export default function DiscoveryPage() {
  const { workOrder } = useWorkflow()
  const [status, setStatus] = useState<Status>("searching")
  const [progress, setProgress] = useState(0)
  const [vendors, setVendors] = useState<VendorResult[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const runRef = useRef(0)

  const runSearch = (bustCache = false, initialProgress = 0) => {
    const key = cacheKey(workOrder)

    if (!bustCache) {
      try {
        const hit = sessionStorage.getItem(key)
        if (hit) {
          setVendors(JSON.parse(hit))
          setProgress(100)
          setStatus("done")
          return
        }
      } catch { /* sessionStorage unavailable */ }
    }

    const run = ++runRef.current
    setStatus("searching")
    setProgress(initialProgress)
    setVendors([])
    setErrorMsg("")

    // Store start timestamp so a refresh can resume from the right progress offset
    try { sessionStorage.setItem(key + ":pending", Date.now().toString()) } catch { /* quota */ }

    fetch("http://localhost:7860/api/vendor-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workOrder),
    })
      .then((r) => {
        if (!r.ok) return r.text().then((t) => Promise.reject(t))
        return r.json()
      })
      .then((data) => {
        if (run !== runRef.current) return
        const all: VendorResult[] = data.vendors ?? []
        try {
          sessionStorage.setItem(key, JSON.stringify(all))
          sessionStorage.removeItem(key + ":pending")
        } catch { /* quota */ }
        setVendors(all)
        setProgress(100)
        setStatus("done")
      })
      .catch((e) => {
        if (run !== runRef.current) return
        try { sessionStorage.removeItem(key + ":pending") } catch { /* quota */ }
        setErrorMsg(typeof e === "string" ? e : "Something went wrong. Please try again.")
        setStatus("error")
      })
  }

  // On mount: restore from cache, re-attach to in-flight search, or start fresh
  useEffect(() => {
    const key = cacheKey(workOrder)
    try {
      const hit = sessionStorage.getItem(key)
      if (hit) { setVendors(JSON.parse(hit)); setProgress(100); setStatus("done"); return }
      const pending = sessionStorage.getItem(key + ":pending")
      if (pending) {
        const startedAt = parseInt(pending, 10)
        const initial = isNaN(startedAt) ? 0 : progressFromElapsed(Date.now() - startedAt)
        runSearch(false, Math.min(99, initial))
        return
      }
    } catch { /* sessionStorage unavailable */ }
    runSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Progress ticker — independent of fetch
  useEffect(() => {
    if (status !== "searching") return
    const id = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return 99
        const step = prev < 25 ? 0.9 : prev < 60 ? 0.45 : prev < 85 ? 0.2 : 0.06
        return Math.min(99, prev + step)
      })
    }, 300)
    return () => clearInterval(id)
  }, [status])

  const phase = phaseFromProgress(progress)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-1.5"
          nativeButton={false}
          render={<Link href="/review" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to review
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

      {/* Searching state */}
      {status === "searching" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discovery in progress</CardTitle>
            <CardDescription>
              The AI agent is browsing BBB to find and rank qualified vendors. This typically
              takes 30–90 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Phase steps */}
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

      {/* Error state */}
      {status === "error" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Alert variant="destructive">
              <RefreshCw />
              <AlertTitle>Discovery failed</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => runSearch(true)} className="w-fit">
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {status === "done" && (
        <div className="flex flex-col gap-6">
          {vendors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 size-8 opacity-40" />
                <p className="font-medium">No vendors found</p>
                <p className="mt-1 text-sm">
                  Try broadening your search or adjusting the service type.
                </p>
                <Button variant="outline" onClick={() => runSearch(true)} className="mt-4">
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
                    Showing top {Math.min(vendors.length, DISPLAY_LIMIT)} of {vendors.length} result{vendors.length !== 1 ? "s" : ""} within 20 miles
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
