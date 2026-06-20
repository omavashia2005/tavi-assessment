"use client"

import { Star, MapPin, DollarSign, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type VendorResult = {
  name: string
  contactInfo: string
  reviewScore: string
  avgCost: string
  distanceMiles: number
}

export function VendorCard({ vendor, rank }: { vendor: VendorResult; rank: number }) {
  const isTop = rank === 1

  return (
    <Card
      className={cn(
        "relative gap-0 p-0 transition-all",
        isTop && "border-warning/60 ring-1 ring-warning/30 shadow-sm",
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          "absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-xs font-semibold",
          isTop
            ? "bg-warning text-warning-foreground"
            : "bg-muted text-muted-foreground",
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </div>

      <CardContent className="flex flex-col gap-3 p-5">
        {/* Name */}
        <div className="flex items-start gap-2 pr-10">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <h3 className="font-semibold leading-snug text-foreground">{vendor.name}</h3>
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-foreground">{vendor.distanceMiles.toFixed(1)} mi</span>
          </span>

          <span className="flex items-center gap-1.5">
            <Star className="size-3.5 shrink-0 text-warning fill-warning" />
            <span className="text-foreground">{vendor.reviewScore}</span>
          </span>

          {vendor.avgCost && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{vendor.avgCost}</span>
            </span>
          )}
        </div>

        {/* Contact info */}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground leading-relaxed">
          {vendor.contactInfo}
        </p>
      </CardContent>
    </Card>
  )
}
