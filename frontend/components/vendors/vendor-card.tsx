"use client"

import { Star, MapPin, Phone, Mail, Clock, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { Vendor } from "@/lib/types"

function formatPrice(value: number) {
  return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
}

export function VendorCard({
  vendor,
  selected,
  onToggle,
}: {
  vendor: Vendor
  selected: boolean
  onToggle: () => void
}) {
  return (
    <Card
      className={cn(
        "group relative cursor-pointer gap-0 p-0 transition-all hover:border-primary/40 hover:shadow-md",
        selected && "border-primary ring-1 ring-primary",
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3 p-5">
        <Checkbox
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={onToggle}
          aria-label={`Select ${vendor.name}`}
          className="mt-1"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold text-foreground">{vendor.name}</h3>
                {vendor.verified && (
                  <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="flex items-center gap-1 font-medium">
                  <Star className="size-3.5 fill-warning text-warning" />
                  {vendor.rating.toFixed(1)}
                  <span className="font-normal text-muted-foreground">({vendor.reviewCount})</span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {vendor.distance.toFixed(1)} mi
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5" />
                  {vendor.responseTime}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-sm font-semibold text-foreground">
                {formatPrice(vendor.priceMin)} – {formatPrice(vendor.priceMax)}
              </span>
              <span className="text-xs text-muted-foreground">est. range</span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {vendor.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {vendor.specialties.map((s) => (
              <Badge key={s} variant="secondary" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {vendor.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {vendor.email}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
