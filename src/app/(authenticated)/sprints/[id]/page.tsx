"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskForm } from "@/components/tasks/task-form";
import { SprintHealthBadge } from "@/components/sprints/sprint-health-badge";
import { BurndownIndicator } from "@/components/sprints/burndown-indicator";
import { RebalancingSuggestions } from "@/components/sprints/rebalancing-suggestions";
import { RetrospectiveNotes } from "@/components/sprints/retrospective-notes";
import { ForecastCard } from "@/components/sprints/forecast-card";
import { useSprint, useForecast } from "@/hooks/use-sprints";
import { useCapacity } from "@/hooks/use-capacity";
import { useAllAccuracies } from "@/hooks/use-developers";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange, formatHours, formatPercent } from "@/utils/format";
import { AlertTriangle, LayoutList, Kanban } from "lucide-react";

type ViewMode = "table" | "board";
const VIEW_KEY = "sprint_view_mode";

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: sprint, isLoading } = useSprint(id);
  const { data: sprintCapacity } = useCapacity(id);
  const { data: forecast } = useForecast(id);
  const { data: accuracies } = useAllAccuracies();

  const capacity = sprintCapacity?.capacity;
  const health = sprintCapacity?.health;
  const burndown = sprintCapacity?.burndown;
  const accuracyByDev = new Map(
    (accuracies ?? []).map((a) => [a.developerId, a])
  );

  const [viewMode, setViewMode] = useState<ViewMode>("table");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "board" || saved === "table") setViewMode(saved);
  }, []);

  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  if (isLoading) {
    return (
      <>
        <Header title="Sprint" />
        <div className="p-6">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </>
    );
  }

  if (!sprint) {
    return (
      <>
        <Header title="Sprint" />
        <div className="p-6">
          <p className="text-muted-foreground">Sprint not found.</p>
        </div>
      </>
    );
  }

  const tasks = sprint.tasks ?? [];

  return (
    <>
      <Header title={sprint.name} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Sprint meta bar */}
        <div className="flex flex-wrap items-center gap-3">
          {sprint.project && (
            <Link href={`/projects/${sprint.project.id}`}>
              <Badge variant="outline">{sprint.project.name}</Badge>
            </Link>
          )}
          <Badge variant="secondary">
            {formatDateRange(sprint.startDate, sprint.endDate)}
          </Badge>
          {health && <SprintHealthBadge health={health} />}
        </div>

        {burndown && <BurndownIndicator burndown={burndown} />}

        {forecast && <ForecastCard forecast={forecast} />}

        {/* Capacity cards */}
        {capacity && capacity.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capacity.map((c) => (
              <Card
                key={c.developerId}
                className={
                  c.overloadRisk
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                    : ""
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {c.developerName}
                    {c.overloadRisk && (
                      <AlertTriangle className="size-3.5 text-red-500" />
                    )}
                    {(() => {
                      const acc = accuracyByDev.get(c.developerId);
                      if (!acc || acc.confidence === "low") return null;
                      const deltaPct = Math.round((acc.factor - 1) * 100);
                      const tone =
                        Math.abs(deltaPct) >= 15
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                          : "bg-muted text-muted-foreground border-border";
                      const tooltip = `Based on ${acc.sampleSize} completed tasks; ${
                        deltaPct === 0
                          ? "on target"
                          : deltaPct > 0
                          ? `tends to under-estimate by ${deltaPct}%`
                          : `tends to over-estimate by ${Math.abs(deltaPct)}%`
                      }.`;
                      return (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-normal ${tone}`}
                          title={tooltip}
                        >
                          ×{acc.factor.toFixed(2)}
                        </Badge>
                      );
                    })()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1 text-xs text-muted-foreground">
                  <div>
                    {formatHours(c.assignedHours)} active /{" "}
                    {formatHours(c.effectiveCapacityHours ?? c.capacityHours)} effective (
                    {formatPercent(c.utilizationPercent)})
                  </div>
                  {(() => {
                    const adj = forecast?.adjustedAnalyses.find(
                      (a) => a.developerId === c.developerId
                    );
                    if (!adj || adj.accuracyFactor === 1) return null;
                    return (
                      <div className="text-muted-foreground">
                        adj. {formatHours(adj.adjustedEffectiveCapacityHours)} (
                        {adj.adjustedUtilizationPercent}%)
                      </div>
                    );
                  })()}
                  {c.meetingHoursPerWeek && c.meetingHoursPerWeek > 0 ? (
                    <div
                      className="text-muted-foreground"
                      title="Meeting hours subtracted from weekly availability"
                    >
                      {formatHours(c.meetingHoursPerWeek)}/wk meetings
                    </div>
                  ) : null}
                  {c.concurrentSprintCount && c.concurrentSprintCount > 0 ? (
                    <div
                      className="text-amber-700 dark:text-amber-400"
                      title={
                        c.overlappingSprintNames && c.overlappingSprintNames.length > 0
                          ? `Also assigned to: ${c.overlappingSprintNames.join(", ")}`
                          : undefined
                      }
                    >
                      Shared with {c.concurrentSprintCount} other sprint
                      {c.concurrentSprintCount === 1 ? "" : "s"} · ×
                      {(c.multiProjectFactor ?? 1).toFixed(2)} multi-project
                    </div>
                  ) : null}
                  {c.completedHours > 0 && (
                    <div className="text-green-600">
                      +{formatHours(c.completedHours)} completed
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rebalancing suggestions (only when at-risk or overloaded) */}
        {capacity && health && health.status !== "healthy" && tasks.length > 0 && (
          <RebalancingSuggestions capacity={capacity} tasks={tasks} />
        )}

        {/* Tasks header with view toggle */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <div className="flex rounded-lg border p-0.5 gap-0.5">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => toggleView("table")}
                  className="size-7"
                >
                  <LayoutList className="size-3.5" />
                </Button>
                <Button
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => toggleView("board")}
                  className="size-7"
                >
                  <Kanban className="size-3.5" />
                </Button>
              </div>
            )}
            <TaskForm sprintId={id} />
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">No tasks yet</p>
            <p className="text-xs text-muted-foreground">
              Add your first task to start planning this sprint.
            </p>
          </div>
        ) : viewMode === "board" ? (
          <TaskKanban tasks={tasks} sprintId={id} />
        ) : (
          <TaskTable tasks={tasks} sprintId={id} />
        )}

        {/* Retrospective — always shown at the bottom */}
        <RetrospectiveNotes sprint={sprint} />
      </div>
    </>
  );
}
