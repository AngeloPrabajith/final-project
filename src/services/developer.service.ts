import { prisma } from "@/lib/prisma";
import type { CreateDeveloperInput } from "@/types";

export async function getAllDevelopers() {
  return prisma.developer.findMany({
    include: { tasks: true, capacityRecords: true },
    orderBy: { name: "asc" },
  });
}

export async function getDeveloperById(id: string) {
  return prisma.developer.findUnique({
    where: { id },
    include: { tasks: { include: { sprint: true } }, capacityRecords: true },
  });
}

export async function createDeveloper(data: CreateDeveloperInput) {
  return prisma.developer.create({ data });
}

export async function updateDeveloper(
  id: string,
  data: Partial<CreateDeveloperInput>
) {
  return prisma.developer.update({ where: { id }, data });
}

export async function deleteDeveloper(id: string) {
  return prisma.developer.delete({ where: { id } });
}
