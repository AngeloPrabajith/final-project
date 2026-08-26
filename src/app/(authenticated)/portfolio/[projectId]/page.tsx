"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { BurndownIndicator } from "@/components/sprints/burndown-indicator";
import { VelocityChart } from "@/components/projects/velocity-chart";
import { DeliveryConfidence } from "@/components/client/delivery-confidence";
import { usePortfolioProject } from "@/hooks/use-portfolio";
import { formatDateRange } from "@/utils/format";

/**
 * Client delivery detail for one project.
 *
 * Note the import list: `BurndownIndicator` and `VelocityChart` are reused
 * verbatim from the manager UI because both render only sprint-level hours and
 * dates — no names, no utilisation, no estimation data. Everything else on
 * this page is client-specific. That's deliberate: the safety of this screen
 * can be audited by reading its imports, without tracing conditional
 * rendering through shared components.
 */
export default function PortfolioProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: project, isLoading } = usePortfolioProject(projectId);

  if (isLoading) {
    return (
      <>
        <Header title="Delivery" />
        <div className="grid gap-4 p-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Delivery" />
        <div className="p-6">
          <p className="text-muted-foreground">
            This project isn&apos;t available to your account.
          </p>
        </div>
      </>
    );
  }

  const activeSprints = project.sprints.filter((s) => s.isActive);
  const pastSprints = project.sprints.filter((s) => !s.isActive);

  return (
    <>
      <Header title={project.name} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link
          href="/portfolio"
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>

        {/* Overall progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Overall progress</CardTitle>
              <span className="text-2xl font-semibold tabular-nums">
                {project.completionPercent}%
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground">{project.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, project.completionPercent)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* In-flight sprints */}
        {activeSprints.length > 0 && (
          <div className="grid gap-3">
            <h2 className="text-sm font-semibold">In progress</h2>
            {activeSprints.map((s) => (
              <Card key={s.sprintId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm">{s.sprintName}</CardTitle>
                    <DeliveryConfidence confidence={s.confidence} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(s.startDate, s.endDate)}
                  </p>
                </CardHeader>
                <CardContent>
                  <BurndownIndicator burndown={s.burndown} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delivery history — reused verbatim, already free of per-person data */}
        <VelocityChart projectId={projectId} />

        {/* Completed sprints */}
        {pastSprints.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Completed sprints</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {pastSprints.map((s) => (
                <div
                  key={s.sprintId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.sprintName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRange(s.startDate, s.endDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {s.burndown.actualProgress}% delivered
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
