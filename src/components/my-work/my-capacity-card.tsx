"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { formatHours } from "@/utils/format";
import type { DeveloperDashboard } from "@/types";

type SprintLoad = DeveloperDashboard["currentSprints"][number];

/**
 * One in-flight sprint's load for the signed-in developer.
 *
 * Deliberately a single-row card rather than a reuse of
 * `DeveloperWorkloadTable` or `CapacitySummary`: both are built around
 * comparing people against each other, which is exactly what this view must
 * not do. There is no chart here because a bar chart of one bar says nothing.
 */
export function MyCapacityCard({ sprint }: { sprint: SprintLoad }) {
  const pct = sprint.utilizationPercent;
  const tone = sprint.overloadRisk
    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
    : pct >= 80
    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
    : "";
  const barTone = sprint.overloadRisk
    ? "bg-red-500"
    : pct >= 80
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <Card className={tone}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{sprint.sprintName}</span>
          {sprint.overloadRisk && (
            <AlertTriangle className="size-4 shrink-0 text-red-500" />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{sprint.projectName}</p>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
          <span className="text-xs text-muted-foreground">
            {formatHours(sprint.assignedHours)} of{" "}
            {formatHours(sprint.effectiveCapacityHours)} effective
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barTone}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {sprint.overloadRisk && (
          <Badge
            variant="outline"
            className="w-fit border-red-200 bg-red-50 text-[10px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            Over your effective capacity
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/** Empty state for an account with no linked developer profile. */
export function NoDeveloperProfile() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">No developer profile linked</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Your account is signed in but isn&apos;t connected to a developer
          record yet, so there&apos;s no workload to show.
        </p>
        <p className="mt-2">
          Ask your project manager to link it from{" "}
          <span className="font-medium">Team &amp; Access</span>.
        </p>
        <p className="mt-3 text-xs">
          You can still change your theme and view your profile in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
