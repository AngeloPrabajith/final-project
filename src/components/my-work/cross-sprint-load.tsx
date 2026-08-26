"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Split } from "lucide-react";
import { formatHours } from "@/utils/format";
import type { DeveloperDashboard } from "@/types";

type SprintLoad = DeveloperDashboard["currentSprints"][number];

/**
 * Explains, from the developer's own side, why their effective capacity in a
 * sprint is lower than their contracted weekly hours.
 *
 * This is the one view in the system that shows a single person's *total*
 * commitment across concurrent sprints. The manager's capacity page models the
 * same thing per sprint; nothing until now showed a developer the combined
 * picture, which is the case the interim report calls out as unaddressed in
 * existing tools.
 *
 * The numbers come straight from `multi-project-capacity.service.ts` via the
 * dashboard — no new modelling, just the existing factors surfaced to the
 * person they describe.
 */
export function CrossSprintLoad({ sprints }: { sprints: SprintLoad[] }) {
  const shared = sprints.filter((s) => s.concurrentSprintCount > 0);
  if (shared.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Split className="size-4 text-muted-foreground" />
          Why your capacity is split
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          You&apos;re committed to more than one sprint at a time. Each sprint
          only gets a share of your hours, and switching between them costs
          more on top.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {shared.map((s) => (
          <div key={s.sprintId} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.sprintName}</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                ×{s.multiProjectFactor.toFixed(2)}
              </Badge>
            </div>

            {/*
              Every multiplier in the chain is shown, in the order the engine
              applies them, so the final figure can be checked by hand. Leaving
              the buffer out made the arithmetic look wrong.
            */}
            <dl className="grid gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Sprint hours after meetings</dt>
                <dd className="tabular-nums">{formatHours(s.capacityHours)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Planning buffer</dt>
                <dd className="tabular-nums">
                  ×{(1 - s.capacityBuffer).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>
                  Split across {s.concurrentSprintCount + 1} concurrent sprints
                </dt>
                <dd className="tabular-nums">
                  ×{s.allocationFactor.toFixed(2)}
                </dd>
              </div>
              {s.contextSwitchFactor < 1 && (
                <div className="flex justify-between gap-3">
                  <dt>Context-switching cost</dt>
                  <dd className="tabular-nums">
                    ×{s.contextSwitchFactor.toFixed(2)}
                  </dd>
                </div>
              )}
              <div className="mt-1 flex justify-between gap-3 border-t pt-1 font-medium text-foreground">
                <dt>Effective capacity here</dt>
                <dd className="tabular-nums">
                  {formatHours(s.effectiveCapacityHours)}
                </dd>
              </div>
            </dl>

            {s.overlappingSprintNames.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Also running: {s.overlappingSprintNames.join(", ")}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
