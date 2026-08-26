"use client";

import { Badge } from "@/components/ui/badge";
import { CircleCheck, CircleAlert, TriangleAlert, OctagonAlert } from "lucide-react";
import type { DeliveryConfidence as Confidence, ForecastRiskBand } from "@/types";

const TONE: Record<ForecastRiskBand, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  moderate:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  critical:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

const ICON: Record<ForecastRiskBand, typeof CircleCheck> = {
  low: CircleCheck,
  moderate: CircleAlert,
  high: TriangleAlert,
  critical: OctagonAlert,
};

/**
 * The client-facing face of the sprint forecast.
 *
 * This is *not* a reuse of `ForecastCard`, and the difference is the point.
 * `ForecastCard` renders `forecast.headline` — "74% chance this sprint misses
 * commitment — rebalance recommended" — plus a contributor breakdown whose
 * `detail` strings name the overloaded developers. None of that is
 * appropriate for an external stakeholder. What survives is the band: a
 * direction of travel the client can act on, with no number to misread and no
 * individual attached to it.
 */
export function DeliveryConfidence({
  confidence,
  size = "default",
}: {
  confidence: Confidence;
  size?: "default" | "sm";
}) {
  const Icon = ICON[confidence.band];
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-normal ${TONE[confidence.band]} ${
        size === "sm" ? "text-[10px]" : "text-xs"
      }`}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {confidence.label}
    </Badge>
  );
}
