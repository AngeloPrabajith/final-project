"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  ForecastContributor,
  ForecastRiskBand,
  SprintForecast,
} from "@/types";

interface Props {
  forecast: SprintForecast;
}

const BAND_STYLES: Record<ForecastRiskBand, { card: string; chip: string; bar: string; text: string }> = {
  low: {
    card: "border-emerald-200 dark:border-emerald-900",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  moderate: {
    card: "border-amber-200 dark:border-amber-900",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  high: {
    card: "border-orange-300 dark:border-orange-900",
    chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
    bar: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
  },
  critical: {
    card: "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    bar: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

const BAND_LABEL: Record<ForecastRiskBand, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
  critical: "Critical risk",
};

function ContributorBar({ contributor }: { contributor: ForecastContributor }) {
  const pct = Math.min(
    100,
    Math.round((contributor.points / contributor.maxPoints) * 100)
  );
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{contributor.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {contributor.points}/{contributor.maxPoints} pts
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/70 dark:bg-foreground/50 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{contributor.detail}</p>
    </div>
  );
}

export function ForecastCard({ forecast }: Props) {
  const [expanded, setExpanded] = useState(true);
  const styles = BAND_STYLES[forecast.riskBand];
  const totalPoints = forecast.contributors.reduce((s, c) => s + c.points, 0);
  const totalMax = forecast.contributors.reduce((s, c) => s + c.maxPoints, 0);

  return (
    <Card className={styles.card}>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-muted-foreground" />
            Sprint Forecast
            <Badge variant="outline" className={`text-xs ${styles.chip}`}>
              {BAND_LABEL[forecast.riskBand]}
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={`text-4xl font-semibold tabular-nums ${styles.text}`}>
              {forecast.probabilityPercent}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {forecast.headline}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="tabular-nums">
              {totalPoints}/{totalMax} risk points
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 capitalize">
              {forecast.riskBand === "low" ? (
                <TrendingDown className="size-3" />
              ) : (
                <TrendingUp className="size-3" />
              )}
              {forecast.riskBand}
            </div>
          </div>
        </div>

        {/* Stacked bar showing contributor share of total */}
        <div
          className="flex h-2 rounded-full bg-muted overflow-hidden"
          aria-label="Risk contributors"
        >
          {forecast.contributors
            .filter((c) => c.points > 0)
            .map((c) => {
              const pct = totalPoints === 0 ? 0 : (c.points / totalPoints) * 100;
              return (
                <div
                  key={c.key}
                  className={styles.bar}
                  style={{ width: `${pct}%`, opacity: 0.35 + (pct / 100) * 0.65 }}
                  title={`${c.label}: ${c.points} pts`}
                />
              );
            })}
        </div>

        {expanded && (
          <div className="grid gap-3 pt-1">
            {forecast.contributors.map((c) => (
              <ContributorBar key={c.key} contributor={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
