import { prisma } from "@/lib/prisma";
import type {
  AdjustedCapacityAnalysis,
  CapacityAnalysis,
  ForecastContributor,
  ForecastRiskBand,
  SprintForecast,
} from "@/types";
import { computeSprintCapacity } from "@/services/overload-detection";
import {
  applyAccuracyToCapacity,
  computeAllAccuracies,
} from "@/services/estimation-accuracy.service";
import { computeMultiProjectFactor } from "@/services/multi-project-capacity.service";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function getRiskBand(probability: number): ForecastRiskBand {
  if (probability < 25) return "low";
  if (probability < 50) return "moderate";
  if (probability < 75) return "high";
  return "critical";
}

function buildHeadline(probability: number, band: ForecastRiskBand): string {
  if (band === "low") return `${probability}% chance of missing this sprint's commitment.`;
  if (band === "moderate") return `${probability}% chance of slippage — monitor closely.`;
  if (band === "high")
    return `${probability}% chance this sprint misses commitment — rebalance recommended.`;
  return `${probability}% probability of sprint failure — intervention required.`;
}

// --- Signal 1: utilisation (0–40) ---
function utilisationPoints(adjusted: AdjustedCapacityAnalysis[]): {
  points: number;
  detail: string;
} {
  if (adjusted.length === 0) return { points: 0, detail: "No developers assigned." };
  const overloadedNames = adjusted
    .filter((a) => a.adjustedOverloadRisk)
    .map((a) => a.developerName);
  const peak = adjusted.reduce((max, a) =>
    a.adjustedUtilizationPercent > max.adjustedUtilizationPercent ? a : max
  );
  const util = peak.adjustedUtilizationPercent;
  let points = 0;
  if (util >= 120) points = 40;
  else if (util >= 100) points = 25 + (util - 100) * 0.75;
  else if (util >= 90) points = 15 + (util - 90);
  else if (util >= 80) points = (util - 80) * 1.5;
  else points = 0;
  points = clamp(Math.round(points), 0, 40);
  const detail =
    overloadedNames.length > 0
      ? `${overloadedNames.join(", ")} over adjusted capacity. Peak ${peak.developerName} ${util}%.`
      : `Peak utilisation ${peak.developerName} at ${util}%.`;
  return { points, detail };
}

// --- Signal 2: estimation accuracy (0–10) ---
function estimationAccuracyPoints(
  adjusted: AdjustedCapacityAnalysis[]
): { points: number; detail: string } {
  if (adjusted.length === 0)
    return { points: 0, detail: "No estimation history available." };
  const weighted = adjusted.reduce(
    (acc, a) => {
      const w = a.assignedHours > 0 ? a.assignedHours : 1;
      return {
        num: acc.num + a.accuracyFactor * w,
        den: acc.den + w,
      };
    },
    { num: 0, den: 0 }
  );
  const teamFactor = weighted.den === 0 ? 1 : weighted.num / weighted.den;
  // Under-estimators (factor > 1) penalised more heavily.
  const deviation = teamFactor - 1;
  let points = 0;
  if (deviation > 0) points = Math.min(10, deviation * 25);
  else points = Math.min(4, Math.abs(deviation) * 8);
  points = clamp(Math.round(points), 0, 10);
  const pct = Math.round((teamFactor - 1) * 100);
  const detail =
    pct === 0
      ? "Team estimation accuracy on target."
      : pct > 0
      ? `Team tends to under-estimate by ${pct}% on average.`
      : `Team tends to over-estimate by ${Math.abs(pct)}% on average.`;
  return { points, detail };
}

// --- Signal 3: velocity trend (0–15) ---
async function velocityTrendPoints(
  projectId: string,
  excludeSprintId: string,
  asOf: Date
): Promise<{ points: number; detail: string }> {
  const pastSprints = await prisma.sprint.findMany({
    where: {
      projectId,
      endDate: { lt: asOf },
      id: { not: excludeSprintId },
    },
    include: { tasks: { select: { estimatedHours: true, status: true } } },
    orderBy: { endDate: "desc" },
    take: 3,
  });
  if (pastSprints.length === 0)
    return { points: 0, detail: "No historic sprints on this project yet." };
  const rates = pastSprints
    .map((s) => {
      const total = s.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      if (total === 0) return null;
      const done = s.tasks
        .filter((t) => t.status === "done")
        .reduce((sum, t) => sum + t.estimatedHours, 0);
      return done / total;
    })
    .filter((r): r is number => r !== null);
  if (rates.length === 0)
    return { points: 0, detail: "Insufficient historic data." };
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  let points = 0;
  if (avg < 0.7) points = 15;
  else if (avg < 0.85) points = 8;
  else if (avg < 0.95) points = 3;
  else points = 0;
  const detail = `Recent ${rates.length}-sprint completion rate: ${Math.round(
    avg * 100
  )}%.`;
  return { points, detail };
}

// --- Signal 4: adhoc history (0–20) ---
async function adhocHistoryPoints(
  projectId: string,
  excludeSprintId: string,
  asOf: Date
): Promise<{ points: number; detail: string }> {
  const pastSprints = await prisma.sprint.findMany({
    where: {
      projectId,
      endDate: { lt: asOf },
      id: { not: excludeSprintId },
    },
    include: { tasks: { select: { estimatedHours: true, type: true } } },
    orderBy: { endDate: "desc" },
    take: 2,
  });
  if (pastSprints.length === 0)
    return { points: 0, detail: "No historic data on unplanned work." };
  let totalHours = 0;
  let adhocHours = 0;
  for (const s of pastSprints) {
    for (const t of s.tasks) {
      totalHours += t.estimatedHours;
      if (t.type === "adhoc") adhocHours += t.estimatedHours;
    }
  }
  if (totalHours === 0)
    return { points: 0, detail: "Historic sprints had no tracked hours." };
  const fraction = adhocHours / totalHours;
  let points = 0;
  if (fraction >= 0.3) points = 20;
  else if (fraction >= 0.2) points = 14;
  else if (fraction >= 0.1) points = 8;
  else if (fraction >= 0.05) points = 3;
  else points = 0;
  const detail = `Ad-hoc work made up ${Math.round(
    fraction * 100
  )}% of recent sprint hours.`;
  return { points, detail };
}

// --- Signal 5: days remaining gap (0–15) ---
function daysRemainingPoints(
  sprint: { startDate: Date; endDate: Date },
  tasks: { estimatedHours: number; status: string }[],
  teamWeeklyHours: number,
  asOf: Date
): { points: number; detail: string } {
  const totalDays = Math.max(
    1,
    Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / MS_PER_DAY)
  );
  if (asOf < sprint.startDate) return { points: 0, detail: "Sprint not started yet." };
  if (asOf >= sprint.endDate)
    return { points: 0, detail: "Sprint already ended." };
  const daysRemaining = Math.max(
    1,
    Math.ceil((sprint.endDate.getTime() - asOf.getTime()) / MS_PER_DAY)
  );
  const remainingHours = tasks
    .filter((t) => t.status !== "done")
    .reduce((s, t) => s + t.estimatedHours, 0);
  const dailyCapacity = (teamWeeklyHours / 7) * (1 - 0) || 1; // buffer-agnostic rough capacity
  const requiredDays = remainingHours / Math.max(1, dailyCapacity);
  const gap = requiredDays - daysRemaining;
  let points = 0;
  if (gap > totalDays * 0.3) points = 15;
  else if (gap > totalDays * 0.1) points = 9;
  else if (gap > 0) points = 4;
  else points = 0;
  const detail =
    gap > 0
      ? `${Math.round(remainingHours)}h remaining needs ~${Math.ceil(
          requiredDays
        )} days at team pace; ${daysRemaining} days left.`
      : `On pace: ${Math.round(remainingHours)}h left with ${daysRemaining} days remaining.`;
  return { points, detail };
}

function squashToProbability(rawPoints: number): number {
  // 1 - exp(-raw/40); raw=0 → 0%, raw=40 → 63%, raw=80 → 86%, raw=100 → 92%
  return Math.round(100 * (1 - Math.exp(-rawPoints / 40)));
}

/**
 * Build per-developer capacity analyses *as of* a moment in time.
 * - When `asOf` is omitted, delegate to the live engine (which also upserts
 *   `CapacityRecord` history — preserved behaviour).
 * - When `asOf` is provided, treat tasks completed after `asOf` as still
 *   active (they were not yet "done" at that vantage point) and compute
 *   capacity locally with the same buffer / meeting-hours / multi-project
 *   formula. Skip the CapacityRecord upsert so retroactive evaluation never
 *   mutates history.
 */
async function buildCapacityAnalyses(
  sprintId: string,
  asOf?: Date,
  persist = true
): Promise<CapacityAnalysis[]> {
  if (!asOf) return computeSprintCapacity(sprintId, { persist });

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { tasks: true },
  });
  if (!sprint) throw new Error("Sprint not found");

  const sprintWeeks = Math.max(
    1,
    Math.round(
      (sprint.endDate.getTime() - sprint.startDate.getTime()) / (MS_PER_DAY * 7)
    )
  );
  const capacityBuffer = sprint.capacityBuffer ?? 0.2;

  const activeHoursMap = new Map<string, number>();
  const completedHoursMap = new Map<string, number>();
  for (const task of sprint.tasks) {
    if (!task.assignedDeveloperId) continue;
    const isDone =
      task.status === "done" &&
      task.completedAt !== null &&
      task.completedAt < asOf;
    if (isDone) {
      completedHoursMap.set(
        task.assignedDeveloperId,
        (completedHoursMap.get(task.assignedDeveloperId) ?? 0) + task.estimatedHours
      );
    } else {
      activeHoursMap.set(
        task.assignedDeveloperId,
        (activeHoursMap.get(task.assignedDeveloperId) ?? 0) + task.estimatedHours
      );
    }
  }

  const allAssignedDevIds = new Set([
    ...activeHoursMap.keys(),
    ...completedHoursMap.keys(),
  ]);
  if (allAssignedDevIds.size === 0) return [];

  const developers = await prisma.developer.findMany({
    where: { id: { in: [...allAssignedDevIds] } },
  });

  const analyses: CapacityAnalysis[] = [];
  for (const dev of developers) {
    const assignedHours = activeHoursMap.get(dev.id) ?? 0;
    const completedHours = completedHoursMap.get(dev.id) ?? 0;
    const meetingHoursPerWeek = dev.meetingHoursPerWeek ?? 0;
    const netWeekly = Math.max(0, dev.weeklyCapacityHours - meetingHoursPerWeek);
    const capacityHours = netWeekly * sprintWeeks;

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
    const overloadRisk = assignedHours > effectiveCapacityHours;
    const utilizationPercent =
      effectiveCapacityHours === 0
        ? assignedHours > 0
          ? 100
          : 0
        : Math.round((assignedHours / effectiveCapacityHours) * 100);

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

/**
 * @param opts.persist Forwarded to the capacity engine. Pass `false` when the
 *   caller is a read-only path that must not write `CapacityRecord` history —
 *   e.g. the client delivery view.
 */
export async function computeSprintForecast(
  sprintId: string,
  opts: { asOf?: Date; persist?: boolean } = {}
): Promise<SprintForecast> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      tasks: { select: { estimatedHours: true, status: true, completedAt: true } },
    },
  });
  if (!sprint) throw new Error("Sprint not found");

  const asOf = opts.asOf;
  const evaluationAnchor = asOf ?? new Date();

  const [analyses, accuracies, developers] = await Promise.all([
    buildCapacityAnalyses(sprintId, asOf, opts.persist ?? true),
    computeAllAccuracies({ asOf }),
    prisma.developer.findMany({
      select: { id: true, weeklyCapacityHours: true },
    }),
  ]);

  const accuracyByDev = new Map(accuracies.map((a) => [a.developerId, a]));
  const adjusted: AdjustedCapacityAnalysis[] = analyses.map(
    (a: CapacityAnalysis) => {
      const accuracy = accuracyByDev.get(a.developerId);
      const factor = accuracy && accuracy.sampleSize > 0 ? accuracy.factor : 1;
      const adjustedEffective = applyAccuracyToCapacity(
        a.effectiveCapacityHours,
        factor
      );
      const adjustedUtil =
        adjustedEffective === 0
          ? a.assignedHours > 0
            ? 100
            : 0
          : Math.round((a.assignedHours / adjustedEffective) * 100);
      return {
        ...a,
        accuracyFactor: factor,
        adjustedEffectiveCapacityHours: Math.round(adjustedEffective * 10) / 10,
        adjustedUtilizationPercent: adjustedUtil,
        adjustedOverloadRisk: a.assignedHours > adjustedEffective,
      };
    }
  );

  const assignedDevIds = new Set(adjusted.map((a) => a.developerId));
  const teamWeeklyHours = developers
    .filter((d) => assignedDevIds.has(d.id))
    .reduce((s, d) => s + d.weeklyCapacityHours, 0);

  const tasksAsOf = sprint.tasks.map((t) => {
    const wasDone =
      t.status === "done" && t.completedAt !== null && t.completedAt < evaluationAnchor;
    return { estimatedHours: t.estimatedHours, status: wasDone ? "done" : t.status };
  });

  const util = utilisationPoints(adjusted);
  const acc = estimationAccuracyPoints(adjusted);
  const vel = await velocityTrendPoints(sprint.projectId, sprintId, evaluationAnchor);
  const ah = await adhocHistoryPoints(sprint.projectId, sprintId, evaluationAnchor);
  const dr = daysRemainingPoints(
    { startDate: sprint.startDate, endDate: sprint.endDate },
    tasksAsOf,
    teamWeeklyHours,
    evaluationAnchor
  );

  const contributors: ForecastContributor[] = [
    { key: "utilisation", label: "Team utilisation", points: util.points, maxPoints: 40, detail: util.detail },
    { key: "adhocHistory", label: "Ad-hoc history", points: ah.points, maxPoints: 20, detail: ah.detail },
    { key: "velocityTrend", label: "Velocity trend", points: vel.points, maxPoints: 15, detail: vel.detail },
    { key: "daysRemaining", label: "Days remaining", points: dr.points, maxPoints: 15, detail: dr.detail },
    { key: "estimationAccuracy", label: "Estimation accuracy", points: acc.points, maxPoints: 10, detail: acc.detail },
  ];

  const raw = contributors.reduce((s, c) => s + c.points, 0);
  const probabilityPercent = squashToProbability(raw);
  const riskBand = getRiskBand(probabilityPercent);
  const headline = buildHeadline(probabilityPercent, riskBand);

  return {
    probabilityPercent,
    riskBand,
    headline,
    contributors,
    adjustedAnalyses: adjusted,
  };
}
