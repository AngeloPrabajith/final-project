"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTable } from "@/components/tasks/task-table";
import { AccuracyCell } from "@/components/developers/accuracy-cell";
import {
  MyCapacityCard,
  NoDeveloperProfile,
} from "@/components/my-work/my-capacity-card";
import { CrossSprintLoad } from "@/components/my-work/cross-sprint-load";
import { useDeveloperDashboard } from "@/hooks/use-capacity";
import { useTasks } from "@/hooks/use-tasks";
import { useAuth } from "@/components/auth-provider";
import { useDeveloperAccuracy } from "@/hooks/use-developers";
import { formatHours } from "@/utils/format";

/**
 * The developer's landing screen.
 *
 * Everything here is first-person: their tasks across every sprint, their own
 * utilisation, their own cross-sprint dilution and their own estimation
 * accuracy. No teammate appears anywhere — and not because the components hide
 * them, but because the API never sends them.
 */
export default function MyWorkPage() {
  const { developerId } = useAuth();
  const { data: dashboard, isLoading } = useDeveloperDashboard();
  const { data: tasks } = useTasks();
  const { data: accuracy } = useDeveloperAccuracy(developerId ?? "");

  if (isLoading) {
    return (
      <>
        <Header title="My Work" />
        <div className="grid gap-4 p-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </>
    );
  }

  if (!dashboard || !dashboard.developerId) {
    return (
      <>
        <Header title="My Work" />
        <div className="p-6">
          <NoDeveloperProfile />
        </div>
      </>
    );
  }

  const openTasks = tasks ?? [];

  return (
    <>
      <Header title="My Work" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Summary strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Open tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {dashboard.openTaskCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatHours(dashboard.openHours)} estimated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Sprints in flight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {dashboard.concurrentSprintCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {dashboard.concurrentSprintCount > 1
                  ? "your capacity is split between them"
                  : "single focus"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Your estimation accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AccuracyCell accuracy={accuracy} voice="self" align="start" />
            </CardContent>
          </Card>
        </div>

        {/* Per-sprint load */}
        {dashboard.currentSprints.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold">Your current load</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.currentSprints.map((s) => (
                <MyCapacityCard key={s.sprintId} sprint={s} />
              ))}
            </div>
          </div>
        )}

        <CrossSprintLoad sprints={dashboard.currentSprints} />

        {/* All my tasks, across every sprint */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">My tasks</h2>
          <TaskTable tasks={openTasks} mode="personal" />
        </div>
      </div>
    </>
  );
}
