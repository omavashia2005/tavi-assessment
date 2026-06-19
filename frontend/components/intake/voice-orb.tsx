"use client"

import { Mic, Sparkles, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentStatus } from "@/lib/types"

const STATUS_COPY: Record<AgentStatus, string> = {
  idle: "Tap to start",
  listening: "Listening",
  thinking: "Thinking",
  extracting: "Extracting details",
  complete: "Work order ready",
}

export function VoiceOrb({
  status,
  onStart,
  disabled,
}: {
  status: AgentStatus
  onStart: () => void
  disabled?: boolean
}) {
  const isActive = status !== "idle" && status !== "complete"

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        aria-label={status === "idle" ? "Start voice conversation" : STATUS_COPY[status]}
        className={cn(
          "group relative flex size-32 items-center justify-center rounded-full outline-none transition-transform sm:size-36",
          status === "idle" && "cursor-pointer hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-ring/30",
          disabled && "cursor-not-allowed",
        )}
      >
        {/* animated rings */}
        {isActive && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:1.8s]" />
            <span className="absolute -inset-3 rounded-full border border-primary/20" />
            <span className="absolute -inset-6 rounded-full border border-primary/10" />
          </>
        )}
        {status === "complete" && (
          <span className="absolute -inset-3 rounded-full border border-success/30" />
        )}

        <span
          className={cn(
            "relative flex size-full items-center justify-center rounded-full shadow-lg transition-colors",
            status === "complete"
              ? "bg-success text-success-foreground shadow-success/20"
              : "bg-primary text-primary-foreground shadow-primary/25",
          )}
        >
          {status === "complete" ? (
            <Check className="size-10" />
          ) : status === "thinking" || status === "extracting" ? (
            <Sparkles className={cn("size-9", isActive && "animate-pulse")} />
          ) : (
            <Mic className="size-9" />
          )}
        </span>
      </button>

      <div className="flex items-center gap-2">
        {isActive && (
          <span className="flex items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-1 animate-pulse rounded-full bg-primary"
                style={{
                  height: `${8 + (i % 2 === 0 ? 10 : 4)}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "0.9s",
                }}
              />
            ))}
          </span>
        )}
        <span
          className={cn(
            "text-sm font-medium",
            status === "complete" ? "text-success" : isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {STATUS_COPY[status]}
        </span>
      </div>
    </div>
  )
}
