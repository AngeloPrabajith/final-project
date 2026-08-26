"use client";

import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { CapacitySummary } from "@/components/dashboard/capacity-summary";
import { AtRiskSprints } from "@/components/dashboard/at-risk-sprints";
import { ActiveSprints } from "@/components/dashboard/active-sprints";
import { useManagerDashboard } from "@/hooks/use-capacity";
import { Skeleton } from "@/components/ui/skeleton";

/** Manager dashboard. Developers get /my-work, clients get /portfolio. */
export default function DashboardPage() {
  const { data: stats, isLoading } = useManagerDashboard();

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            <StatsCards stats={stats} />
            <div className="grid gap-6 lg:grid-cols-2">
              <ActiveSprints />
              {stats.atRiskSprints && stats.atRiskSprints.length > 0 && (
                <AtRiskSprints sprints={stats.atRiskSprints} />
              )}
            </div>
            <CapacitySummary data={stats.capacitySummary} />
          </>
        ) : (
          <p className="text-muted-foreground">
            Failed to load dashboard data.
          </p>
        )}
      </div>
    </>
  );
}
