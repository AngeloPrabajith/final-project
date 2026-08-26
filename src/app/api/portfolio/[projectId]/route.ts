import { NextRequest, NextResponse } from "next/server";
import {
  assertProjectAccess,
  notFound,
  requireAuth,
  requireRole,
  withRoute,
} from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { computeBurndown } from "@/services/overload-detection";
import { computeSprintForecast } from "@/services/sprint-forecast.service";
import { deliveryConfidenceFor } from "@/lib/redact";
import type {
  ClientProjectDetail,
  ClientSprintProgress,
  ForecastRiskBand,
} from "@/types";

/**
 * The client delivery view for one project, assembled server-side.
 *
 * Composing this in the browser would mean one `/capacity` and one `/forecast`
 * request per sprint, and every one of those responses would have to be
 * redacted separately. Building the whole page payload here means there is a
 * single place where the client's data shape is decided — and it contains no
 * developer, no capacity figure and no probability by construction.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireRole(ctx, "client", "manager");

    const { projectId } = await params;
    await assertProjectAccess(ctx, projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sprints: {
          include: { tasks: true },
          orderBy: { startDate: "desc" },
        },
      },
    });
    if (!project) throw notFound("Project not found");

    const now = new Date();
    const sprints: ClientSprintProgress[] = [];

    for (const sprint of project.sprints) {
      const isActive = sprint.startDate <= now && sprint.endDate >= now;

      let band: ForecastRiskBand = "low";
      if (isActive) {
        try {
          // persist:false — a client opening their delivery page must not
          // write CapacityRecord history as a side effect.
          const forecast = await computeSprintForecast(sprint.id, {
            persist: false,
          });
          band = forecast.riskBand;
        } catch (err) {
          console.error(`Forecast failed for sprint ${sprint.id}:`, err);
        }
      }

      sprints.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
        isActive,
        burndown: computeBurndown(sprint, sprint.tasks),
        confidence: deliveryConfidenceFor(band),
      });
    }

    const allTasks = project.sprints.flatMap((s) => s.tasks);
    const totalHours = allTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const doneHours = allTasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + t.estimatedHours, 0);

    const body: ClientProjectDetail = {
      id: project.id,
      name: project.name,
      description: project.description,
      completionPercent:
        totalHours === 0 ? 0 : Math.round((doneHours / totalHours) * 100),
      sprints,
    };

    return NextResponse.json(body);
  });
}
