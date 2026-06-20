"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const STEPS = [
  { href: "/", label: "Intake", step: 1 },
  { href: "/discovery", label: "Discovery", step: 2 },
  { href: "/vendors", label: "Vendors", step: 3 },
  { href: "/launch", label: "Launch", step: 4 },
] as const

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
  const activeStep = currentStepFor(pathname)

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
              return (
                <div key={s.href} className="flex items-center gap-1">
                  <Link
                    href={s.href}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive && "bg-accent text-accent-foreground font-medium",
                      !isActive && "text-muted-foreground",
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
                  </Link>
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
            {STEPS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-label={`Go to step ${s.step}: ${s.label}`}
                aria-current={s.step === activeStep ? "step" : undefined}
                className={cn(
                  "h-2 w-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  s.step <= activeStep ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
