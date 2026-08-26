import { prisma } from "@/lib/prisma";
import type {
  CapacityAnalysis,
  SimulationResult,
  SprintHealth,
  SprintHealthStatus,
  BurndownData,
  BurndownStatus,
} from "@/types";
import { computeMultiProjectFactor } from "@/services/multi-project-capacity.service";

export function calculateCapacity(
  weeklyHours: number,
  sprintWeeks: number
): number {
  return weeklyHours * sprintWeeks;
}

export function calculateAssignedHours(
  tasks: { estimatedHours: number }[]
): number {
  return tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
}

export function detectOverload(
  assignedHours: number,
  effectiveCapacityHours: number
): boolean {
  return assignedHours > effectiveCapacityHours;
}

export function getOverloadPercentage(
  assignedHours: number,
  effectiveCapacityHours: number
): number {
  if (effectiveCapacityHours === 0) return assignedHours > 0 ? 100 : 0;
  return Math.round((assignedHours / effectiveCapacityHours) * 100);
}

function getSprintWeeks(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(diffWeeks));
}

/**
 * @param opts.persist Write a `CapacityRecord` row per developer as a side
 *   effect (default true — this is how capacity history accumulates). Pass
 *   `false` on read paths that must not mutate, notably anything serving an
 *   external client.
 */
export async function computeSprintCapacity(
  sprintId: string,
  opts: { persist?: boolean } = {}
): Promise<CapacityAnalysis[]> {
  const persist = opts.persist ?? true;
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      tasks: { include: { assignedDeveloper: true } },
    },
  });

  if (!sprint) throw new Error("Sprint not found");

  const sprintWeeks = getSprintWeeks(sprint.startDate, sprint.endDate);
  const capacityBuffer = (sprint as { capacityBuffer?: number }).capacityBuffer ?? 0.2;

  const developers = await prisma.developer.findMany();

  // Separate active (todo/inprogress) from completed (done) hours per developer
  const activeHoursMap = new Map<string, number>();
  const completedHoursMap = new Map<string, number>();

  for (const task of sprint.tasks) {
    if (!task.assignedDeveloperId) continue;
    const devId = task.assignedDeveloperId;
    if (task.status === "done") {
      completedHoursMap.set(devId, (completedHoursMap.get(devId) ?? 0) + task.estimatedHours);
    } else {
      activeHoursMap.set(devId, (activeHoursMap.get(devId) ?? 0) + task.estimatedHours);
    }
  }

  const allAssignedDevIds = new Set([
    ...activeHoursMap.keys(),
    ...completedHoursMap.keys(),
  ]);

  const analyses: CapacityAnalysis[] = [];

  for (const dev of developers) {
    if (!allAssignedDevIds.has(dev.id)) continue;

    const assignedHours = activeHoursMap.get(dev.id) ?? 0;
    const completedHours = completedHoursMap.get(dev.id) ?? 0;
    const meetingHoursPerWeek =
      (dev as { meetingHoursPerWeek?: number | null }).meetingHoursPerWeek ?? 0;
    const netWeeklyHours = Math.max(
      0,
      dev.weeklyCapacityHours - meetingHoursPerWeek
    );
    const capacityHours = calculateCapacity(netWeeklyHours, sprintWeeks);

    // Multi-project factor: never break the base engine if the helper fails.
    let multi;
    try {
      multi = await computeMultiProjectFactor(dev.id, sprintId);
    } catch {
      multi = {
        concurrentSprintCount: 0,
        allocationFactor: 1,
        contextSwitchFactor: 1,
        combinedFactor: 1,
        overlappingSprintNames: [],
      };
    }

    const effectiveCapacityHours =
      Math.round(
        capacityHours * (1 - capacityBuffer) * multi.combinedFactor * 10
      ) / 10;
    const overloadRisk = detectOverload(assignedHours, effectiveCapacityHours);
    const utilizationPercent = getOverloadPercentage(
      assignedHours,
      effectiveCapacityHours
    );

    if (persist) {
      await prisma.capacityRecord.upsert({
        where: { developerId_sprintId: { developerId: dev.id, sprintId } },
        update: { assignedHours, capacityHours, overloadRisk },
        create: { developerId: dev.id, sprintId, assignedHours, capacityHours, overloadRisk },
      });
    }

    analyses.push({
      developerId: dev.id,
      developerName: dev.name,
      assignedHours,
      completedHours,
      capacityHours,
      effectiveCapacityHours,
      utilizationPercent,
      overloadRisk,
      meetingHoursPerWeek,
      multiProjectFactor: multi.combinedFactor,
      allocationFactor: multi.allocationFactor,
      contextSwitchFactor: multi.contextSwitchFactor,
      concurrentSprintCount: multi.concurrentSprintCount,
      overlappingSprintNames: multi.overlappingSprintNames,
    });
  }

  return analyses;
}

export function computeSprintHealth(analyses: CapacityAnalysis[]): SprintHealth {
  if (analyses.length === 0) {
    return {
      score: 100,
      status: "healthy",
      overloadedDeveloperCount: 0,
      atRiskDeveloperCount: 0,
      averageUtilization: 0,
      recommendation: "No developers assigned to this sprint yet.",
    };
  }

  const overloaded = analyses.filter((a) => a.overloadRisk);
  const atRisk = analyses.filter((a) => !a.overloadRisk && a.utilizationPercent >= 80);
  const avgUtil = Math.round(
    analyses.reduce((s, a) => s + a.utilizationPercent, 0) / analyses.length
  );

  let score = 100;
  score -= overloaded.length * 30;
  score -= atRisk.length * 10;
  if (avgUtil > 85) score -= 5;
  score = Math.max(0, score);

  let status: SprintHealthStatus = "healthy";
  if (score < 40) status = "overloaded";
  else if (score < 70) status = "at-risk";

  let recommendation = "Sprint workload looks good.";
  if (overloaded.length > 0) {
    const names = overloaded.map((a) => a.developerName).join(", ");
    recommendation = `${names} ${overloaded.length === 1 ? "is" : "are"} overloaded — consider moving tasks or adjusting the capacity buffer.`;
  } else if (atRisk.length > 0) {
    const names = atRisk.map((a) => a.developerName).join(", ");
    recommendation = `${names} ${atRisk.length === 1 ? "is" : "are"} near capacity (≥80%) — leave buffer for ad-hoc work.`;
  }

  return {
    score,
    status,
    overloadedDeveloperCount: overloaded.length,
    atRiskDeveloperCount: atRisk.length,
    averageUtilization: avgUtil,
    recommendation,
  };
}

export function computeBurndown(
  sprint: { startDate: Date; endDate: Date },
  tasks: { estimatedHours: number; status: string }[]
): BurndownData {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysTotal = Math.max(
    1,
    Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / msPerDay)
  );
  const daysPassed = Math.max(
    0,
    Math.min(daysTotal, Math.round((now.getTime() - sprint.startDate.getTime()) / msPerDay))
  );

  const totalHours = tasks.reduce((s, t) => s + t.estimatedHours, 0);
  const completedHours = tasks
    .filter((t) => t.status === "done")
    .reduce((s, t) => s + t.estimatedHours, 0);

  const expectedProgress = totalHours === 0 ? 0 : Math.round((daysPassed / daysTotal) * 100);
  const actualProgress = totalHours === 0 ? 0 : Math.round((completedHours / totalHours) * 100);

  const diff = actualProgress - expectedProgress;
  let status: BurndownStatus = "on-track";
  if (diff > 10) status = "ahead";
  else if (diff < -20) status = "at-risk";
  else if (diff < -5) status = "behind";

  return { expectedProgress, actualProgress, status, totalHours, completedHours, daysTotal, daysPassed };
}

export function simulateTaskAddition(
  currentAnalysis: CapacityAnalysis,
  additionalHours: number
): SimulationResult {
  const newAssigned = currentAnalysis.assignedHours + additionalHours;
  const after: CapacityAnalysis = {
    ...currentAnalysis,
    assignedHours: newAssigned,
    utilizationPercent: getOverloadPercentage(newAssigned, currentAnalysis.effectiveCapacityHours),
    overloadRisk: detectOverload(newAssigned, currentAnalysis.effectiveCapacityHours),
  };

  return {
    before: currentAnalysis,
    after,
    wouldCauseOverload: !currentAnalysis.overloadRisk && after.overloadRisk,
  };
}
