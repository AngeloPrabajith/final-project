import { prisma } from "@/lib/prisma";
import {
  buildCapacityAnalysis,
  computeSprintCapacity,
  getSprintWeeks,
  resolveMultiProjectFactor,
  simulateTaskAddition,
} from "./overload-detection";
import type { CapacityAnalysis, SimulationResult } from "@/types";

export async function getSprintCapacity(
  sprintId: string
): Promise<CapacityAnalysis[]> {
  return computeSprintCapacity(sprintId);
}

export async function simulateAdHocTask(
  sprintId: string,
  developerId: string,
  additionalHours: number
): Promise<SimulationResult> {
  const analyses = await computeSprintCapacity(sprintId);
  const devAnalysis = analyses.find((a) => a.developerId === developerId);

  if (!devAnalysis) {
    const dev = await prisma.developer.findUnique({
      where: { id: developerId },
    });
    if (!dev) throw new Error("Developer not found");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) throw new Error("Sprint not found");

    // The developer has no tasks here yet, so they are absent from the live
    // analyses — but they must be judged against the same chain as everyone
    // already on the sprint. For the multi-project factor we model them as
    // having joined it: computeMultiProjectFactor counts their *other*
    // overlapping sprints, which is exactly their concurrency once this ad-hoc
    // task lands on them. (Joining would also dilute their capacity in those
    // other sprints; the simulator reports this sprint only.)
    const emptyAnalysis = buildCapacityAnalysis({
      developer: dev,
      sprintWeeks: getSprintWeeks(sprint.startDate, sprint.endDate),
      capacityBuffer: sprint.capacityBuffer,
      multi: await resolveMultiProjectFactor(dev.id, sprintId),
      assignedHours: 0,
      completedHours: 0,
    });

    return simulateTaskAddition(emptyAnalysis, additionalHours);
  }

  return simulateTaskAddition(devAnalysis, additionalHours);
}
