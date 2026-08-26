import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireDeveloperIdentity,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import { getAllSprints, createSprint } from "@/services/sprint.service";
import { redactSprintForClient } from "@/lib/redact";

/**
 * The `projectId` query parameter is ANDed with the caller's server-derived
 * scope inside `getAllSprints` — never substituted for it. A developer or
 * client passing someone else's `projectId` narrows their results, it does not
 * widen them.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;

    if (ctx.role === "developer") {
      const developerId = requireDeveloperIdentity(ctx);
      return NextResponse.json(await getAllSprints(projectId, { developerId }));
    }

    const sprints = await getAllSprints(projectId, {
      projectIds: ctx.projectIds,
    });

    if (ctx.role === "client") {
      return NextResponse.json(sprints.map(redactSprintForClient));
    }

    return NextResponse.json(sprints);
  });
}

export async function POST(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const sprint = await createSprint(await req.json());
    return NextResponse.json(sprint, { status: 201 });
  });
}
