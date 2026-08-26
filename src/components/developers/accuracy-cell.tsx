"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { EstimationAccuracy } from "@/types";

/**
 * Renders a developer's estimation-accuracy factor.
 *
 * Extracted from the manager `/developers` table so the developer's own
 * "My Work" screen can show the same figure. `voice` changes only the wording:
 * a manager reading a roster sees "under-estimates by 28%", the developer
 * seeing their own number gets the second person, which reads as feedback
 * rather than assessment.
 */
export function AccuracyCell({
  accuracy,
  voice = "third-person",
  align = "end",
}: {
  accuracy?: EstimationAccuracy;
  voice?: "third-person" | "self";
  align?: "start" | "end";
}) {
  if (!accuracy || accuracy.sampleSize === 0) {
    return <span className="text-xs text-muted-foreground">No history</span>;
  }

  const deltaPct = Math.round((accuracy.factor - 1) * 100);
  const tone =
    accuracy.confidence === "low"
      ? "bg-muted text-muted-foreground border-border"
      : Math.abs(deltaPct) >= 15
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";

  const label =
    voice === "self"
      ? deltaPct === 0
        ? "your estimates are on target"
        : deltaPct > 0
        ? `your tasks take ${deltaPct}% longer than you estimate`
        : `your tasks finish ${Math.abs(deltaPct)}% under estimate`
      : deltaPct === 0
      ? "on target"
      : deltaPct > 0
      ? `under-estimates by ${deltaPct}%`
      : `over-estimates by ${Math.abs(deltaPct)}%`;

  const trendIcon =
    accuracy.trend === "improving" ? (
      <TrendingUp className="size-3 text-emerald-600" />
    ) : accuracy.trend === "degrading" ? (
      <TrendingDown className="size-3 text-red-500" />
    ) : accuracy.trend === "stable" ? (
      <Minus className="size-3 text-muted-foreground" />
    ) : null;

  return (
    <div
      className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}
    >
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-xs font-mono ${tone}`}>
          ×{accuracy.factor.toFixed(2)}
        </Badge>
        {trendIcon}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {label} · n={accuracy.sampleSize} ({accuracy.confidence})
      </div>
    </div>
  );
}
