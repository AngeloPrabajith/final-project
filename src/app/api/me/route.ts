import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withRoute, notFound } from "@/lib/authorize";
import type { MeResponse } from "@/types";

/**
 * The caller's identity plus the scope the server resolved for them.
 *
 * The client reads this on load rather than trusting the `user` object cached
 * in localStorage: that copy is written at login and never refreshed, so it
 * goes stale the moment a manager changes someone's role or links their
 * developer profile. This endpoint is the authoritative answer.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw notFound("User not found");

    const body: MeResponse = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      role: ctx.role,
      developerId: ctx.developerId,
      projectIds: ctx.projectIds,
    };

    return NextResponse.json(body);
  });
}
