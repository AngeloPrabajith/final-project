"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BurndownData } from "@/types";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface BurndownIndicatorProps {
  burndown: BurndownData;
}

const statusConfig = {
  ahead: {
    label: "Ahead of Schedule",
    icon: TrendingUp,
    color: "text-green-600",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  "on-track": {
    label: "On Track",
    icon: Minus,
    color: "text-blue-600",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  behind: {
    label: "Behind Schedule",
    icon: TrendingDown,
    color: "text-amber-600",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  "at-risk": {
    label: "At Risk",
    icon: AlertTriangle,
    color: "text-red-600",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
};

export function BurndownIndicator({ burndown }: BurndownIndicatorProps) {
  const config = statusConfig[burndown.status];
  const Icon = config.icon;

  const pctComplete = burndown.totalHours > 0
    ? Math.round((burndown.completedHours / burndown.totalHours) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Sprint Progress</CardTitle>
          <Badge
            variant="outline"
            className={`gap-1.5 text-xs ${config.badgeClass}`}
          >
            <Icon className="size-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {/* Expected progress bar */}
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Expected</span>
            <span>{burndown.expectedProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-muted-foreground/40 transition-all"
              style={{ width: `${Math.min(100, burndown.expectedProgress)}%` }}
            />
          </div>
        </div>
        {/* Actual progress bar */}
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Actual</span>
            <span>{pctComplete}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all ${
                burndown.status === "ahead"
                  ? "bg-green-500"
                  : burndown.status === "on-track"
                  ? "bg-blue-500"
                  : burndown.status === "behind"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, pctComplete)}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground pt-1">
          <span>{burndown.completedHours}h done of {burndown.totalHours}h total</span>
          <span>Day {burndown.daysPassed} of {burndown.daysTotal}</span>
        </div>
      </CardContent>
    </Card>
  );
}
