import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withRoute } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import {
  computeSprintCapacity,
  computeSprintHealth,
} from "@/services/overload-detection";
import { computeSprintForecast } from "@/services/sprint-forecast.service";
import { computeDeveloperAccuracy } from "@/services/estimation-accuracy.service";
import { deliveryConfidenceFor, personalCapacity } from "@/lib/redact";
import type {
  AtRiskSprint,
  CapacityAnalysis,
  ClientDashboard,
  ClientProjectSummary,
  DashboardResponse,
  DeveloperDashboard,
  ForecastRiskBand,
  ManagerDashboard,
} from "@/types";

/**
 * One URL, three payloads. The response is a discriminated union on `kind`,
 * so the client renders the right dashboard without a second round-trip and
 * without ever receiving another role's data "just in case".
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);

    if (ctx.role === "developer") {
      return NextResponse.json(await developerDashboard(ctx.developerId));
    }
    if (ctx.role === "client") {
      return NextResponse.json(await clientDashboard(ctx.projectIds ?? []));
    }
    return NextResponse.json(await managerDashboard());
  });
}

// --- manager: the original full-fat payload ---

async function managerDashboard(): Promise<ManagerDashboard> {
  const [totalProjects, totalDevelopers, sprints] = await Promise.all([
    prisma.project.count(),
    prisma.developer.count(),
    prisma.sprint.findMany({
      include: { project: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const now = new Date();
  const activeSprints = sprints.filter(
    (s) => s.startDate <= now && s.endDate >= now
  );

  let capacitySummary: CapacityAnalysis[] = [];
  let overloadedDevelopers = 0;
  const atRiskSprints: AtRiskSprint[] = [];

  const sprintsToAnalyse =
    activeSprints.length > 0 ? activeSprints : sprints.slice(0, 3);

  if (sprintsToAnalyse.length > 0) {
    const allAnalyses = await Promise.all(
      sprintsToAnalyse.map((s) => computeSprintCapacity(s.id))
    );

    for (let i = 0; i < sprintsToAnalyse.length; i++) {
      const sprint = sprintsToAnalyse[i];
      const analyses = allAnalyses[i];
      const health = computeSprintHealth(analyses);

      if (i === 0) {
        capacitySummary = analyses;
        overloadedDevelopers = analyses.filter((a) => a.overloadRisk).length;
      }

      if (health.score < 70) {
        atRiskSprints.push({
          id: sprint.id,
          name: sprint.name,
          projectName: sprint.project?.name ?? "Unknown",
          health,
          startDate: sprint.startDate.toISOString(),
          endDate: sprint.endDate.toISOString(),
        });
      }
    }
  }

  return {
    kind: "manager",
    totalProjects,
    activeSprints: activeSprints.length,
    totalDevelopers,
    overloadedDevelopers,
    capacitySummary,
    atRiskSprints,
  };
}

// --- developer: own workload only ---

async function developerDashboard(
  developerId: string | null
): Promise<DeveloperDashboard> {
  const empty: DeveloperDashboard = {
    kind: "developer",
    developerId: null,
    developerName: null,
    openTaskCount: 0,
    openHours: 0,
    currentSprints: [],
    concurrentSprintCount: 0,
    accuracyFactor: null,
    accuracyConfidence: null,
  };

  // An account with the developer role but no linked profile can see nothing.
  // Fail closed rather than falling back to team-wide figures.
  if (!developerId) return empty;

  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    select: { id: true, name: true },
  });
  if (!developer) return empty;

  const now = new Date();
  const openTasks = await prisma.task.findMany({
    where: { assignedDeveloperId: developerId, status: { not: "done" } },
    select: { estimatedHours: true },
  });

  // Sprints in flight right now that this developer actually has work in.
  const liveSprints = await prisma.sprint.findMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      tasks: { some: { assignedDeveloperId: developerId } },
    },
    include: { project: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  const currentSprints: DeveloperDashboard["currentSprints"] = [];
  for (const sprint of liveSprints) {
    const analyses = await computeSprintCapacity(sprint.id, { persist: false });
    const mine = personalCapacity(analyses, developerId);
    if (!mine) continue;
    currentSprints.push({
      sprintId: sprint.id,
      sprintName: sprint.name,
      projectName: sprint.project?.name ?? "Unknown",
      assignedHours: mine.assignedHours,
      capacityHours: mine.capacityHours,
      capacityBuffer: sprint.capacityBuffer ?? 0.2,
      effectiveCapacityHours: mine.effectiveCapacityHours,
      utilizationPercent: mine.utilizationPercent,
      overloadRisk: mine.overloadRisk,
      meetingHoursPerWeek: mine.meetingHoursPerWeek ?? 0,
      // These describe the developer's *own* competing commitments, so they
      // are theirs to see — it is the same data the manager uses to explain
      // why their effective capacity is lower than their nominal hours.
      concurrentSprintCount: mine.concurrentSprintCount ?? 0,
      overlappingSprintNames: mine.overlappingSprintNames ?? [],
      allocationFactor: mine.allocationFactor ?? 1,
      contextSwitchFactor: mine.contextSwitchFactor ?? 1,
      multiProjectFactor: mine.multiProjectFactor ?? 1,
    });
  }

  const accuracy = await computeDeveloperAccuracy(developerId);

  return {
    kind: "developer",
    developerId: developer.id,
    developerName: developer.name,
    openTaskCount: openTasks.length,
    openHours:
      Math.round(openTasks.reduce((s, t) => s + t.estimatedHours, 0) * 10) / 10,
    currentSprints,
    concurrentSprintCount: liveSprints.length,
    accuracyFactor: accuracy.sampleSize > 0 ? accuracy.factor : null,
    accuracyConfidence: accuracy.sampleSize > 0 ? accuracy.confidence : null,
  };
}

// --- client: delivery progress per assigned project ---

const BAND_SEVERITY: Record<ForecastRiskBand, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

async function clientDashboard(projectIds: string[]): Promise<ClientDashboard> {
  if (projectIds.length === 0) return { kind: "client", projects: [] };

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      sprints: { include: { tasks: { select: { estimatedHours: true, status: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const summaries: ClientProjectSummary[] = [];

  for (const project of projects) {
    const totalHours = project.sprints.flatMap((s) => s.tasks).reduce(
      (sum, t) => sum + t.estimatedHours,
      0
    );
    const doneHours = project.sprints
      .flatMap((s) => s.tasks)
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + t.estimatedHours, 0);

    const activeSprints = project.sprints.filter(
      (s) => s.startDate <= now && s.endDate >= now
    );

    // Worst band across the sprints currently in flight — a client should see
    // the risk on the work happening now, not an average that hides it.
    // `persist: false` keeps this read-only; see computeSprintCapacity.
    let worst: ForecastRiskBand = "low";
    for (const sprint of activeSprints) {
      try {
        const forecast = await computeSprintForecast(sprint.id, {
          persist: false,
        });
        if (BAND_SEVERITY[forecast.riskBand] > BAND_SEVERITY[worst]) {
          worst = forecast.riskBand;
        }
      } catch (err) {
        console.error(`Forecast failed for sprint ${sprint.id}:`, err);
      }
    }

    summaries.push({
      projectId: project.id,
      projectName: project.name,
      description: project.description,
      activeSprintCount: activeSprints.length,
      totalSprintCount: project.sprints.length,
      completionPercent:
        totalHours === 0 ? 0 : Math.round((doneHours / totalHours) * 100),
      confidence: deliveryConfidenceFor(worst),
    });
  }

  return { kind: "client", projects: summaries };
}

export type { DashboardResponse };
