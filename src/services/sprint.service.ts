import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateSprintInput, UpdateSprintInput } from "@/types";

export interface SprintScope {
  /** Restrict to these projects. `null`/omitted = unrestricted. */
  projectIds?: string[] | null;
  /**
   * Restrict to sprints this developer has work in, and prune each sprint's
   * `tasks` to theirs. `null`/omitted = unrestricted.
   */
  developerId?: string | null;
}

/**
 * IMPORTANT: `projectId` is caller-supplied (a query parameter) while `scope`
 * is server-derived. They are ANDed — the scope is never replaced by the
 * parameter — so passing someone else's `projectId` narrows the result set
 * rather than widening it.
 */
export async function getAllSprints(
  projectId?: string,
  scope: SprintScope = {}
) {
  const and: Prisma.SprintWhereInput[] = [];
  if (projectId) and.push({ projectId });
  if (scope.projectIds) and.push({ projectId: { in: scope.projectIds } });
  if (scope.developerId) {
    and.push({ tasks: { some: { assignedDeveloperId: scope.developerId } } });
  }

  return prisma.sprint.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    include: {
      project: true,
      tasks: {
        where: scope.developerId
          ? { assignedDeveloperId: scope.developerId }
          : undefined,
        include: { assignedDeveloper: true },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getSprintById(id: string, scope: SprintScope = {}) {
  return prisma.sprint.findUnique({
    where: { id },
    include: {
      project: true,
      tasks: {
        where: scope.developerId
          ? { assignedDeveloperId: scope.developerId }
          : undefined,
        include: { assignedDeveloper: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createSprint(data: CreateSprintInput) {
  return prisma.sprint.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      projectId: data.projectId,
      capacityBuffer: data.capacityBuffer ?? 0.2,
    },
    include: { project: true },
  });
}

export async function updateSprint(id: string, data: UpdateSprintInput) {
  return prisma.sprint.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
      ...(data.capacityBuffer !== undefined && { capacityBuffer: data.capacityBuffer }),
      ...(data.retrospectiveNotes !== undefined && { retrospectiveNotes: data.retrospectiveNotes }),
    },
    include: { project: true },
  });
}

export async function deleteSprint(id: string) {
  return prisma.sprint.delete({ where: { id } });
}

/**
 * Find every other sprint that:
 *   - is not the target sprint,
 *   - has a date window overlapping the target's window, and
 *   - has at least one task assigned to the given developer.
 *
 * Used by the multi-project capacity factor to detect developers who are
 * committed to multiple concurrent sprints in the same calendar window.
 */
export async function findOverlappingSprintsForDeveloper(
  developerId: string,
  targetSprintId: string
) {
  const target = await prisma.sprint.findUnique({
    where: { id: targetSprintId },
    select: { startDate: true, endDate: true },
  });
  if (!target) return [];
  return prisma.sprint.findMany({
    where: {
      AND: [
        { id: { not: targetSprintId } },
        { startDate: { lt: target.endDate } },
        { endDate: { gt: target.startDate } },
        { tasks: { some: { assignedDeveloperId: developerId } } },
      ],
    },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}
