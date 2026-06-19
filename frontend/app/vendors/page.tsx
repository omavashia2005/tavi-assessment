"use client"

import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function VendorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-1.5"
        nativeButton={false}
        render={<Link href="/discovery" />}
      >
        <ArrowLeft data-icon="inline-start" />
        Back to discovery
      </Button>

      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <Users className="size-8 text-muted-foreground" />
              <EmptyTitle>No vendors available</EmptyTitle>
              <EmptyDescription>
                Vendors returned by discovery will appear here for selection.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
