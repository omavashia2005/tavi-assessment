"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TranscriptTurn } from "@/lib/types"

export function Transcript({
  turns,
  thinking,
  onSend,
  disabled,
}: {
  turns: TranscriptTurn[]
  thinking: boolean
  onSend: (message: string) => void
  disabled?: boolean
}) {
  const messagesRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState("")

  useLayoutEffect(() => {
    const messages = messagesRef.current
    if (messages) messages.scrollTop = messages.scrollHeight
  }, [turns.length, thinking])

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    onSend(text)
    setMessage("")
  }

  return (
    <div className="flex min-h-72 flex-col">
      <div ref={messagesRef} className="flex max-h-96 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">No conversation yet</p>
            <p className="max-w-xs text-sm text-muted-foreground text-pretty">
              Start the voice agent or type below to describe the maintenance issue.
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={cn(
              "flex gap-3",
              turn.role === "user" && "flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                turn.role === "agent"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
              aria-hidden="true"
            >
              {turn.role === "agent" ? "T" : "JM"}
            </div>
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                turn.role === "agent"
                  ? "rounded-tl-sm bg-muted text-foreground"
                  : "rounded-tr-sm bg-primary text-primary-foreground",
              )}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              T
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="mt-5 flex gap-2 border-t border-border pt-4">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a message…"
          aria-label="Chat message"
          disabled={disabled}
          className="h-9"
        />
        <Button type="submit" size="icon-lg" disabled={disabled || !message.trim()} aria-label="Send message">
          <Send />
        </Button>
      </form>
    </div>
  )
}
