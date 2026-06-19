"use client"

import { Mic, Square } from "lucide-react"
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
  active,
}: {
  status: AgentStatus
  onStart: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        aria-label={active ? "Stop voice conversation" : "Start voice conversation"}
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50",
          active && "bg-destructive hover:bg-destructive/80",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {active ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
      </button>

      <span className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
        {active ? STATUS_COPY[status] : "Start voice"}
      </span>
    </div>
  )
}
