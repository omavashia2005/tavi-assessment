"use client"

import Link from "next/link"
import { ArrowLeft, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function LaunchPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-1.5"
        nativeButton={false}
        render={<Link href="/vendors" />}
      >
        <ArrowLeft data-icon="inline-start" />
        Back to vendors
      </Button>

      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <Rocket className="size-8 text-muted-foreground" />
              <EmptyTitle>Nothing to launch yet</EmptyTitle>
              <EmptyDescription>
                Complete a work order and select real vendors before launching outreach.
              </EmptyDescription>
            </EmptyHeader>
            <Button nativeButton={false} render={<Link href="/" />}>
              Start at intake
            </Button>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
