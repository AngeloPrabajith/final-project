import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager, withRoute } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { normaliseRole } from "@/lib/roles";
import type { AdminUser } from "@/types";

/** Manager-only: the roster of login accounts, their roles and their links. */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        developer: { select: { id: true, name: true } },
        clientProjects: { select: { projectId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows: AdminUser[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: normaliseRole(u.role),
      rawRole: u.role,
      developerId: u.developer?.id ?? null,
      developerName: u.developer?.name ?? null,
      projectIds: u.clientProjects.map((p) => p.projectId),
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json(rows);
  });
}
