import { prisma } from "@/lib/prisma";
import type {
  AccuracyConfidence,
  AccuracyTrend,
  EstimationAccuracy,
} from "@/types";

const DEFAULT_WINDOW_DAYS = 90;
const SHRINKAGE_TARGET_N = 10;

interface CompletedTaskSample {
  estimatedHours: number;
  actualHours: number;
  completedAt: Date;
}

function confidenceFor(n: number): AccuracyConfidence {
  if (n < 5) return "low";
  if (n < 15) return "medium";
  return "high";
}

function computeRawFactor(samples: CompletedTaskSample[]): {
  rawFactor: number;
  sumEstimated: number;
  sumActual: number;
} {
  const sumEstimated = samples.reduce((s, t) => s + t.estimatedHours, 0);
  const sumActual = samples.reduce((s, t) => s + t.actualHours, 0);
  const rawFactor = sumEstimated === 0 ? 1 : sumActual / sumEstimated;
  return { rawFactor, sumEstimated, sumActual };
}

function applyShrinkage(
  sumEstimated: number,
  sumActual: number,
  n: number
): number {
  if (n === 0 || sumEstimated === 0) return 1;
  const avgEst = sumEstimated / n;
  const k = Math.max(0, SHRINKAGE_TARGET_N - n);
  const num = sumActual + k * avgEst;
  const den = sumEstimated + k * avgEst;
  return den === 0 ? 1 : num / den;
}

function computeTrend(samples: CompletedTaskSample[]): AccuracyTrend | undefined {
  if (samples.length < 8) return undefined;
  const sorted = [...samples].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
  );
  const mid = Math.floor(sorted.length / 2);
  const early = computeRawFactor(sorted.slice(0, mid)).rawFactor;
  const late = computeRawFactor(sorted.slice(mid)).rawFactor;
  const earlyDistance = Math.abs(early - 1);
  const lateDistance = Math.abs(late - 1);
  const delta = earlyDistance - lateDistance;
  if (delta > 0.05) return "improving";
  if (delta < -0.05) return "degrading";
  return "stable";
}

async function fetchSamples(
  developerId: string,
  windowDays: number,
  asOf?: Date
): Promise<CompletedTaskSample[]> {
  const anchor = asOf ?? new Date();
  const since = new Date(anchor);
  since.setDate(since.getDate() - windowDays);
  const tasks = await prisma.task.findMany({
    where: {
      assignedDeveloperId: developerId,
      status: "done",
      actualHours: { not: null },
      completedAt: { gte: since, lt: anchor },
    },
    select: { estimatedHours: true, actualHours: true, completedAt: true },
  });
  return tasks
    .filter(
      (t): t is { estimatedHours: number; actualHours: number; completedAt: Date } =>
        t.actualHours !== null && t.completedAt !== null
    )
    .map((t) => ({
      estimatedHours: t.estimatedHours,
      actualHours: t.actualHours,
      completedAt: t.completedAt,
    }));
}

function buildAccuracy(
  developerId: string,
  developerName: string,
  samples: CompletedTaskSample[]
): EstimationAccuracy {
  const n = samples.length;
  const { rawFactor, sumEstimated, sumActual } = computeRawFactor(samples);
  const factor = applyShrinkage(sumEstimated, sumActual, n);
  const trend = computeTrend(samples);
  return {
    developerId,
    developerName,
    factor: Math.round(factor * 100) / 100,
    rawFactor: Math.round(rawFactor * 100) / 100,
    sampleSize: n,
    totalEstimated: Math.round(sumEstimated * 10) / 10,
    totalActual: Math.round(sumActual * 10) / 10,
    confidence: confidenceFor(n),
    trend,
  };
}

export async function computeDeveloperAccuracy(
  developerId: string,
  opts: { windowDays?: number; asOf?: Date } = {}
): Promise<EstimationAccuracy> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const dev = await prisma.developer.findUnique({ where: { id: developerId } });
  if (!dev) throw new Error("Developer not found");
  const samples = await fetchSamples(developerId, windowDays, opts.asOf);
  return buildAccuracy(dev.id, dev.name, samples);
}

export async function computeAllAccuracies(
  opts: { windowDays?: number; asOf?: Date } = {}
): Promise<EstimationAccuracy[]> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const anchor = opts.asOf ?? new Date();
  const since = new Date(anchor);
  since.setDate(since.getDate() - windowDays);

  const [developers, rawTasks] = await Promise.all([
    prisma.developer.findMany({ orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: {
        status: "done",
        actualHours: { not: null },
        completedAt: { gte: since, lt: anchor },
        assignedDeveloperId: { not: null },
      },
      select: {
        assignedDeveloperId: true,
        estimatedHours: true,
        actualHours: true,
        completedAt: true,
      },
    }),
  ]);

  const byDev = new Map<string, CompletedTaskSample[]>();
  for (const t of rawTasks) {
    if (!t.assignedDeveloperId || t.actualHours === null || t.completedAt === null) continue;
    const arr = byDev.get(t.assignedDeveloperId) ?? [];
    arr.push({
      estimatedHours: t.estimatedHours,
      actualHours: t.actualHours,
      completedAt: t.completedAt,
    });
    byDev.set(t.assignedDeveloperId, arr);
  }

  return developers.map((dev) =>
    buildAccuracy(dev.id, dev.name, byDev.get(dev.id) ?? [])
  );
}

export function applyAccuracyToCapacity(
  effectiveCapacityHours: number,
  factor: number
): number {
  if (!factor || factor <= 0) return effectiveCapacityHours;
  return effectiveCapacityHours / factor;
}
