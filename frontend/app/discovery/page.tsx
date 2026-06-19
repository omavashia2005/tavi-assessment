"use client"

import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function DiscoveryPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
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

      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <Search className="size-8 text-muted-foreground" />
              <EmptyTitle>No discovery has been started</EmptyTitle>
              <EmptyDescription>
                Vendor discovery results will appear here after a real search provider is connected.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" nativeButton={false} render={<Link href="/vendors" />}>
              View vendors
            </Button>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
