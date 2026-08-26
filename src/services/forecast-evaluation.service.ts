import { prisma } from "@/lib/prisma";
import { computeSprintForecast } from "@/services/sprint-forecast.service";
import type {
  ForecastEvaluation,
  ForecastEvaluationSummary,
  ForecastOutcome,
  ForecastRiskBand,
} from "@/types";

const HIGH_BANDS: ForecastRiskBand[] = ["high", "critical"];

function classifyOutcome(actualCompletionRate: number): ForecastOutcome {
  if (actualCompletionRate >= 0.9) return "met";
  if (actualCompletionRate >= 0.7) return "partial";
  return "missed";
}

/**
 * Walk every completed sprint, recompute the forecast as-of that sprint's
 * start date (so the model sees only what was knowable at planning time),
 * compare against actual outcome, and return calibration metrics.
 *
 * Used by the /evaluation page to validate the predictive thesis quantitatively.
 */
export async function evaluateAllCompletedSprints(): Promise<ForecastEvaluationSummary> {
  const now = new Date();
  const completedSprints = await prisma.sprint.findMany({
    where: { endDate: { lt: now } },
    include: {
      project: { select: { name: true } },
      tasks: { select: { estimatedHours: true, status: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const evaluations: ForecastEvaluation[] = [];
  for (const sprint of completedSprints) {
    let forecast;
    try {
      forecast = await computeSprintForecast(sprint.id, {
        asOf: sprint.startDate,
      });
    } catch (err) {
      console.error(
        `Failed to compute retroactive forecast for ${sprint.id}:`,
        err
      );
      continue;
    }

    const totalEstimated = sprint.tasks.reduce(
      (sum, t) => sum + t.estimatedHours,
      0
    );
    const completedEstimated = sprint.tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    const actualCompletionRate =
      totalEstimated === 0 ? 1 : completedEstimated / totalEstimated;

    const top = [...forecast.contributors].sort(
      (a, b) => b.points - a.points
    )[0];

    evaluations.push({
      sprintId: sprint.id,
      sprintName: sprint.name,
      projectName: sprint.project?.name ?? "Unknown",
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      predictedProbability: forecast.probabilityPercent,
      predictedBand: forecast.riskBand,
      topContributor: { key: top.key, label: top.label, points: top.points },
      actualCompletionRate: Math.round(actualCompletionRate * 100) / 100,
      totalEstimatedHours: Math.round(totalEstimated * 10) / 10,
      completedEstimatedHours: Math.round(completedEstimated * 10) / 10,
      outcome: classifyOutcome(actualCompletionRate),
    });
  }

  // Calibration metrics — high-band predictions should match missed/partial outcomes.
  let hitCount = 0;
  let falseAlarmCount = 0;
  let missedAlarmCount = 0;
  for (const e of evaluations) {
    const predictedHigh = HIGH_BANDS.includes(e.predictedBand);
    const actualBad = e.outcome !== "met";
    if (predictedHigh && actualBad) hitCount += 1;
    if (predictedHigh && !actualBad) falseAlarmCount += 1;
    if (!predictedHigh && e.outcome === "missed") missedAlarmCount += 1;
  }

  return {
    evaluations,
    hitCount,
    falseAlarmCount,
    missedAlarmCount,
    totalSprints: evaluations.length,
  };
}
