import { NextRequest, NextResponse } from "next/server";
import {
  HttpError,
  notFound,
  requireAuth,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { normaliseRole, ROLES, type Role } from "@/lib/roles";
import type { UpdateAdminUserInput } from "@/types";

/**
 * Manager-only: set a user's role, link them to a developer profile, and
 * choose which projects a client may see.
 *
 * Two guards worth knowing about:
 *  - `Developer.userId` is unique, so re-linking a user to a different
 *    developer must null the previous row first or Postgres raises P2002.
 *  - Demoting the last remaining manager would lock everyone out of account
 *    administration, so it is refused.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);

    const { id } = await params;
    const body = (await req.json()) as UpdateAdminUserInput;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw notFound("User not found");

    if (body.role !== undefined && !ROLES.includes(body.role)) {
      throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}.`);
    }

    const nextRole: Role = body.role ?? normaliseRole(target.role);

    // Last-manager guard.
    if (normaliseRole(target.role) === "manager" && nextRole !== "manager") {
      const managers = await prisma.user.findMany({ select: { role: true } });
      const managerCount = managers.filter(
        (u) => normaliseRole(u.role) === "manager"
      ).length;
      if (managerCount <= 1) {
        throw new HttpError(
          409,
          "This is the only manager account — promote someone else before changing this one."
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (body.role !== undefined) {
        await tx.user.update({ where: { id }, data: { role: body.role } });
      }

      if (body.developerId !== undefined) {
        // Always clear this user's existing link first; then, if a target
        // developer was given, clear anyone else attached to it before linking.
        await tx.developer.updateMany({
          where: { userId: id },
          data: { userId: null },
        });
        if (body.developerId) {
          await tx.developer.updateMany({
            where: { userId: id, NOT: { id: body.developerId } },
            data: { userId: null },
          });
          await tx.developer.update({
            where: { id: body.developerId },
            data: { userId: id },
          });
        }
      }

      if (body.projectIds !== undefined) {
        await tx.projectClient.deleteMany({ where: { userId: id } });
        if (body.projectIds.length > 0) {
          await tx.projectClient.createMany({
            data: body.projectIds.map((projectId) => ({
              userId: id,
              projectId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  });
}
