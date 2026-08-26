import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateProjectInput } from "@/types";

/**
 * @param scope.projectIds Restrict to these project ids. `null`/omitted means
 *   unrestricted — the manager path, byte-for-byte the previous behaviour.
 * @param scope.developerId Restrict to projects this developer has work in.
 *
 * Note the `include: { sprints: true }` here returns whole sprint rows, which
 * carry `retrospectiveNotes`. Callers serving anyone but a manager must
 * reshape the result — see `redactProjectListForClient` in the route.
 */
export async function getAllProjects(
  scope: { projectIds?: string[] | null; developerId?: string | null } = {}
) {
  const and: Prisma.ProjectWhereInput[] = [];
  if (scope.projectIds) and.push({ id: { in: scope.projectIds } });
  if (scope.developerId) {
    and.push({
      sprints: { some: { tasks: { some: { assignedDeveloperId: scope.developerId } } } },
    });
  }

  return prisma.project.findMany({
    where: and.length > 0 ? { AND: and } : undefined,
    include: { sprints: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { sprints: { orderBy: { startDate: "desc" } } },
  });
}

export async function createProject(data: CreateProjectInput) {
  return prisma.project.create({ data });
}

export async function updateProject(id: string, data: Partial<CreateProjectInput>) {
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}
