import { prisma } from "@/lib/prisma";
import {
  computeSprintCapacity,
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

    const diffMs = sprint.endDate.getTime() - sprint.startDate.getTime();
    const sprintWeeks = Math.max(
      1,
      Math.round(diffMs / (1000 * 60 * 60 * 24 * 7))
    );
    const capacityHours = dev.weeklyCapacityHours * sprintWeeks;

    const emptyAnalysis: CapacityAnalysis = {
      developerId: dev.id,
      developerName: dev.name,
      assignedHours: 0,
      completedHours: 0,
      capacityHours,
      effectiveCapacityHours: capacityHours,
      utilizationPercent: 0,
      overloadRisk: false,
    };

    return simulateTaskAddition(emptyAnalysis, additionalHours);
  }

  return simulateTaskAddition(devAnalysis, additionalHours);
}
