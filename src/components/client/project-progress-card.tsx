"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryConfidence } from "./delivery-confidence";
import { ArrowRight } from "lucide-react";
import type { ClientProjectSummary } from "@/types";

/**
 * A project tile on the client's landing page.
 *
 * Not a reuse of `ProjectCard`: that component wires a delete button to
 * `useDeleteProject()` and leads with sprint count, which is an internal
 * planning detail. A client wants delivery progress and whether it is on
 * track, so the content genuinely differs — reusing it would have meant
 * stripping out more than was left.
 */
export function ProjectProgressCard({
  project,
}: {
  project: ClientProjectSummary;
}) {
  return (
    <Link href={`/portfolio/${project.projectId}`} className="group block">
      <Card className="h-full transition-colors group-hover:border-foreground/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">
              {project.projectName}
            </CardTitle>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          {project.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">
                {project.completionPercent}%
              </span>
              <span className="text-xs text-muted-foreground">complete</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, project.completionPercent)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <DeliveryConfidence confidence={project.confidence} size="sm" />
            <span className="text-[11px] text-muted-foreground">
              {project.activeSprintCount > 0
                ? `${project.activeSprintCount} sprint${
                    project.activeSprintCount === 1 ? "" : "s"
                  } in progress`
                : `${project.totalSprintCount} sprint${
                    project.totalSprintCount === 1 ? "" : "s"
                  } · none active`}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
