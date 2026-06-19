"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PipecatClient } from "@pipecat-ai/client-js"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { ArrowRight, RotateCcw, MessageSquareText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { VoiceOrb } from "@/components/intake/voice-orb"
import { Transcript } from "@/components/intake/transcript"
import { WorkOrderSummary } from "@/components/intake/work-order-summary"
import { useWorkflow } from "@/components/workflow-provider"
import { WorkOrderSchema, type AgentStatus, type TranscriptTurn } from "@/lib/types"

const PIPECAT_URL = process.env.NEXT_PUBLIC_PIPECAT_URL ?? "http://localhost:7860"

export default function IntakePage() {
  const { workOrder, setWorkOrder, resetWorkflow } = useWorkflow()
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [status, setStatus] = useState<AgentStatus>("idle")
  const [connecting, setConnecting] = useState(false)
  const clientRef = useRef<PipecatClient | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const client = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      enableCam: false,
      callbacks: {
        onTrackStarted: (track, participant) => {
          if (track.kind !== "audio" || participant?.local || !audioRef.current) return
          audioRef.current.srcObject = new MediaStream([track])
          void audioRef.current.play()
        },
        onUserStartedSpeaking: () => setStatus("listening"),
        onUserStoppedSpeaking: () => setStatus("thinking"),
        onBotLlmStarted: () => setStatus("thinking"),
        onBotStoppedSpeaking: () => setStatus("listening"),
        onUserTranscript: ({ final, text }) => {
          if (!final || !text.trim()) return
          setTurns((previous) => [
            ...previous,
            { id: Date.now(), role: "user", text },
          ])
        },
        onBotTranscript: ({ text }) => {
          if (!text.trim()) return
          setTurns((previous) => [
            ...previous,
            { id: Date.now(), role: "agent", text },
          ])
        },
        onServerMessage: (data) => {
          const result = WorkOrderSchema.safeParse(data)
          if (result.success) setWorkOrder(result.data)
        },
        onDisconnected: () => setStatus("idle"),
        onError: () => {
          setStatus("idle")
          toast.error("Voice session failed")
        },
      },
    })

    clientRef.current = client
    return () => {
      clientRef.current = null
      void client.disconnect()
    }
  }, [setWorkOrder])

  const connect = useCallback(async () => {
    const client = clientRef.current
    if (!client || client.state === "ready") return client

    setConnecting(true)
    setStatus("thinking")
    try {
      await client.startBotAndConnect({
        endpoint: `${PIPECAT_URL}/start`,
        requestData: { transport: "webrtc" },
      })
      setStatus("listening")
      return client
    } catch (error) {
      setStatus("idle")
      toast.error("Could not start Tavi", {
        description: error instanceof Error ? error.message : "Check that the backend is running.",
      })
      return null
    } finally {
      setConnecting(false)
    }
  }, [])

  const play = useCallback(async () => {
    const client = clientRef.current
    if (client?.connected) {
      await client.disconnect()
      return
    }
    await connect()
  }, [connect])

  const restart = useCallback(() => {
    void clientRef.current?.disconnect()
    setStatus("idle")
    setTurns([])
    resetWorkflow()
  }, [resetWorkflow])

  const sendMessage = useCallback(async (text: string) => {
    const client = await connect()
    if (!client) return
    setTurns((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text },
    ])
    await client.sendText(text, { run_immediately: true, audio_response: true })
  }, [connect])

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
              <VoiceOrb status={status} onStart={() => void play()} disabled={connecting} />
              <audio ref={audioRef} autoPlay className="hidden" />
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
                thinking={status === "thinking"}
                onSend={(message) => void sendMessage(message)}
                disabled={connecting}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={restart}
              disabled={
                status === "idle" &&
                turns.length === 0 &&
                !Object.values(workOrder).some(Boolean)
              }
            >
              <RotateCcw data-icon="inline-start" />
              Restart
            </Button>
            {turns.length > 0 || Object.values(workOrder).some(Boolean) ? (
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
