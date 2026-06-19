"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PipecatClient } from "@pipecat-ai/client-js"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { ArrowRight, RotateCcw, MessageSquareText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VoiceOrb } from "@/components/intake/voice-orb"
import { Transcript } from "@/components/intake/transcript"
import { WorkOrderSummary } from "@/components/intake/work-order-summary"
import { useWorkflow } from "@/components/workflow-provider"
import {
  ChatResponseSchema,
  WorkOrderSchema,
  type AgentStatus,
  type TranscriptTurn,
} from "@/lib/types"

const PIPECAT_URL = process.env.NEXT_PUBLIC_PIPECAT_URL ?? "http://localhost:7860"

export default function IntakePage() {
  const { workOrder, setWorkOrder, updateField, resetWorkflow } = useWorkflow()
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [status, setStatus] = useState<AgentStatus>("idle")
  const [connecting, setConnecting] = useState(false)
  const clientRef = useRef<PipecatClient | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const voiceEnabledRef = useRef(false)

  useEffect(() => {
    const client = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: false,
      enableCam: false,
      callbacks: {
        onTrackStarted: (track, participant) => {
          if (
            !voiceEnabledRef.current ||
            track.kind !== "audio" ||
            participant?.local ||
            !audioRef.current
          ) return
          audioRef.current.srcObject = new MediaStream([track])
          void audioRef.current.play()
        },
        onUserStartedSpeaking: () => voiceEnabledRef.current && setStatus("listening"),
        onUserStoppedSpeaking: () => voiceEnabledRef.current && setStatus("thinking"),
        onBotLlmStarted: () => setStatus("thinking"),
        onBotStoppedSpeaking: () => setStatus(voiceEnabledRef.current ? "listening" : "idle"),
        onUserTranscript: ({ final, text }) => {
          if (!final || !text.trim()) return
          setTurns((previous) => [
            ...previous,
            { id: Date.now(), role: "user", text },
          ])
        },
        onBotOutput: ({ aggregated_by, text }) => {
          if (aggregated_by !== "sentence" || !text.trim()) return
          setTurns((previous) => [
            ...previous,
            { id: Date.now(), role: "agent", text },
          ])
        },
        onBotLlmStopped: () => {
          if (!voiceEnabledRef.current) setStatus("idle")
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

  const connect = useCallback(async (voice = false) => {
    const client = clientRef.current
    if (!client) return null

    if (voice && !voiceEnabledRef.current) {
      voiceEnabledRef.current = true
      client.enableMic(true)
      await client.initDevices()
    }
    if (client.state === "ready") {
      setStatus(voice ? "listening" : "idle")
      return client
    }

    setConnecting(true)
    try {
      await client.startBotAndConnect({
        endpoint: `${PIPECAT_URL}/start`,
        requestData: { transport: "webrtc" },
      })
      setStatus(voice ? "listening" : "idle")
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
    if (client?.connected && voiceEnabledRef.current) {
      await client.disconnect()
      return
    }
    await connect(true)
  }, [connect])

  const restart = useCallback(() => {
    void clientRef.current?.disconnect()
    voiceEnabledRef.current = false
    setStatus("idle")
    setTurns([])
    resetWorkflow()
  }, [resetWorkflow])

  const sendMessage = useCallback(async (text: string) => {
    const nextTurns: TranscriptTurn[] = [
      ...turns,
      { id: Date.now(), role: "user", text },
    ]
    setTurns(nextTurns)
    setStatus("thinking")

    try {
      const response = await fetch(`${PIPECAT_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          workOrder,
        }),
      })
      if (!response.ok) throw new Error(await response.text())

      const result = ChatResponseSchema.parse(await response.json())
      setTurns((previous) => [
        ...previous,
        { id: Date.now(), role: "agent", text: result.assistant },
      ])
      setWorkOrder(result.workOrder)
    } catch (error) {
      toast.error("Message was not sent", {
        description: error instanceof Error ? error.message : "Try again.",
      })
    } finally {
      setStatus("idle")
    }
  }, [setWorkOrder, turns, workOrder])

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
          Create a work order
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">
          Talk or type to Tavi the way you&apos;d brief a colleague. The assistant asks follow-ups and
          structures everything into a work order in real time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Conversation column */}
        <Card className="lg:col-span-3">
          <CardContent className="pt-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="font-medium">Conversation</h2>
                <p className="text-xs text-muted-foreground">Type below or start voice input.</p>
              </div>
              <VoiceOrb
                status={status}
                active={voiceEnabledRef.current}
                onStart={() => void play()}
                disabled={connecting}
              />
              <audio ref={audioRef} autoPlay className="hidden" />
            </div>
            <div className="min-h-[28rem]">
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
          <WorkOrderSummary workOrder={workOrder} onChange={updateField} />
        </div>
      </div>
    </div>
  )
}
