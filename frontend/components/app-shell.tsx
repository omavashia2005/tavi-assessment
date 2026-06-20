"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useWorkflow } from "@/components/workflow-provider"
import type { WorkOrder } from "@/lib/types"

const STEPS = [
  { href: "/", label: "Intake", step: 1 },
  { href: "/discovery", label: "Discovery", step: 2 },
  { href: "/vendors", label: "Vendors", step: 3 },
  { href: "/launch", label: "Launch", step: 4 },
] as const

const REQUIRED: (keyof WorkOrder)[] = ["siteLocation", "serviceType", "budget", "requiredServiceDate"]

function workOrderComplete(wo: WorkOrder) {
  return REQUIRED.every((f) => wo[f].trim().length > 0)
}


function TaviMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M12 7v13M7 20h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-base font-semibold tracking-tight">Tavi</span>
        <span className="text-[11px] text-muted-foreground">Facility Operations</span>
      </div>
    </div>
  )
}

function currentStepFor(pathname: string) {
  const match = STEPS.find((s) => s.href === pathname)
  return match?.step ?? 1
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { workOrder, selectedVendorIds, vendorSearch } = useWorkflow()
  const activeStep = currentStepFor(pathname)

  function isUnlocked(step: number) {
    if (step <= 1) return true
    if (step === 2) return workOrderComplete(workOrder)
    if (step === 3) return vendorSearch.status === "done" && vendorSearch.vendors.length > 0
    if (step === 4) return selectedVendorIds.length > 0
    return false
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Tavi home">
            <TaviMark />
          </Link>

          <nav aria-label="Workflow progress" className="hidden items-center gap-1 md:flex">
            {STEPS.map((s, i) => {
              const isDone = s.step < activeStep
              const isActive = s.step === activeStep
              const unlocked = isUnlocked(s.step)

              const pill = (
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive && "bg-accent text-accent-foreground font-medium",
                    !isActive && unlocked && "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    !unlocked && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                      isDone && "bg-primary text-primary-foreground",
                      isActive && "bg-primary text-primary-foreground",
                      !isDone && !isActive && "border border-border bg-card text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="size-3" /> : s.step}
                  </span>
                  {s.label}
                </span>
              )

              return (
                <div key={s.href} className="flex items-center gap-1">
                  {unlocked ? (
                    <Link
                      href={s.href}
                      aria-current={isActive ? "step" : undefined}
                      className="focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-full"
                    >
                      {pill}
                    </Link>
                  ) : (
                    <span aria-disabled="true">{pill}</span>
                  )}
                  {i < STEPS.length - 1 && (
                    <div className="h-px w-4 bg-border" aria-hidden="true" />
                  )}
                </div>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
              Demo workspace
            </Badge>
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              JM
            </div>
          </div>
        </div>

        {/* Mobile step indicator */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 md:hidden">
          <span className="text-xs font-medium text-muted-foreground">
            Step {activeStep} of {STEPS.length}
          </span>
          <span className="text-xs font-semibold">{STEPS[activeStep - 1].label}</span>
          <div className="ml-auto flex gap-1">
            {STEPS.map((s) => {
              const unlocked = isUnlocked(s.step)
              const dot = (
                <span
                  className={cn(
                    "h-2 w-6 rounded-full transition-colors",
                    s.step <= activeStep ? "bg-primary" : "bg-border",
                    !unlocked && "opacity-40",
                  )}
                />
              )
              return unlocked ? (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-label={`Go to step ${s.step}: ${s.label}`}
                  aria-current={s.step === activeStep ? "step" : undefined}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {dot}
                </Link>
              ) : (
                <span key={s.href} aria-disabled="true">{dot}</span>
              )
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
