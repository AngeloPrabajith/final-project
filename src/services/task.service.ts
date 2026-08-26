import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateTaskInput, UpdateTaskInput } from "@/types";

export interface TaskScope {
  /** Only tasks assigned to this developer. `null`/omitted = unrestricted. */
  developerId?: string | null;
  /** Only tasks whose sprint belongs to one of these projects. */
  projectIds?: string[] | null;
}

/**
 * IMPORTANT: `sprintId` comes from the query string; `scope` is derived
 * server-side from the caller's identity. They are ANDed, never swapped, so a
 * developer asking for a sprint they aren't on gets an empty list rather than
 * a colleague's tasks.
 */
export async function getAllTasks(sprintId?: string, scope: TaskScope = {}) {
  const and: Prisma.TaskWhereInput[] = [];
  if (sprintId) and.push({ sprintId });
  if (scope.developerId) and.push({ assignedDeveloperId: scope.developerId });
  if (scope.projectIds) {
    and.push({ sprint: { projectId: { in: scope.projectIds } } });
  }

  return prisma.task.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    include: { assignedDeveloper: true, sprint: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: { assignedDeveloper: true, sprint: true },
  });
}

export async function createTask(data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      estimatedHours: data.estimatedHours,
      type: data.type,
      priority: data.priority ?? "medium",
      status: data.status || "todo",
      assignedDeveloperId: data.assignedDeveloperId || null,
      sprintId: data.sprintId,
    },
    include: { assignedDeveloper: true, sprint: true },
  });
}

export async function updateTask(id: string, data: UpdateTaskInput) {
  const {
    completedAt,
    actualHours,
    status,
    ...rest
  } = data;

  // Normalise: completing a task stamps completedAt if not provided.
  // Reverting from done clears actualHours + completedAt to avoid stale data.
  const normalised: Record<string, unknown> = { ...rest };
  if (status !== undefined) normalised.status = status;
  if (actualHours !== undefined) normalised.actualHours = actualHours;

  if (status === "done") {
    normalised.completedAt = completedAt ? new Date(completedAt) : new Date();
  } else if (status !== undefined) {
    normalised.completedAt = null;
    normalised.actualHours = null;
  } else if (completedAt !== undefined) {
    normalised.completedAt = completedAt === null ? null : new Date(completedAt);
  }

  return prisma.task.update({
    where: { id },
    data: normalised,
    include: { assignedDeveloper: true, sprint: true },
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}
