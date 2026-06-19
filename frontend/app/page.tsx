"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ArrowRight, RotateCcw, MessageSquareText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { VoiceOrb } from "@/components/intake/voice-orb"
import { Transcript } from "@/components/intake/transcript"
import { WorkOrderSummary } from "@/components/intake/work-order-summary"
import { useWorkflow } from "@/components/workflow-provider"
import type { AgentStatus, TranscriptTurn } from "@/lib/types"

export default function IntakePage() {
  const { workOrder, resetWorkflow } = useWorkflow()
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [status, setStatus] = useState<AgentStatus>("idle")

  const play = useCallback(() => {
    setStatus((current) => current === "listening" ? "idle" : "listening")
  }, [])

  const restart = useCallback(() => {
    setStatus("idle")
    setTurns([])
    resetWorkflow()
  }, [resetWorkflow])

  const sendMessage = useCallback((text: string) => {
    setTurns((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text },
    ])
    setStatus("idle")
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <MessageSquareText className="size-3" />
            Voice or chat intake
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Create a maintenance work order
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">
          Talk or type to Tavi the way you&apos;d brief a colleague. The assistant asks follow-ups and
          structures everything into a work order in real time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversation column */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col items-center gap-6 py-4">
              <VoiceOrb status={status} onStart={play} />
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-medium">Transcript</h2>
              <Separator className="flex-1" />
            </div>
            <div className="min-h-72">
              <Transcript
                turns={turns}
                thinking={false}
                onSend={sendMessage}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={restart}
              disabled={status === "idle" && turns.length === 0}
            >
              <RotateCcw data-icon="inline-start" />
              Restart
            </Button>
            {turns.length > 0 ? (
              <Button nativeButton={false} render={<Link href="/review" />}>
                Review work order
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button disabled>
                Review work order
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Live summary column */}
        <div className="lg:col-span-1">
          <WorkOrderSummary workOrder={workOrder} />
        </div>
      </div>
    </div>
  )
}
