import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireDeveloperIdentity,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import { getAllProjects, createProject } from "@/services/project.service";
import { redactProjectForClient } from "@/lib/redact";

/**
 * Managers see every project. Clients see only the ones granted to them.
 * Developers see only the projects they actually have work in, and only the
 * id and name — "My Work" groups their tasks by project and needs nothing more.
 *
 * The service returns whole sprint rows (which carry `retrospectiveNotes`), so
 * every non-manager branch reshapes the result rather than passing it through.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);

    if (ctx.role === "developer") {
      const developerId = requireDeveloperIdentity(ctx);
      const projects = await getAllProjects({ developerId });
      return NextResponse.json(
        projects.map((p) => ({ id: p.id, name: p.name }))
      );
    }

    const projects = await getAllProjects({ projectIds: ctx.projectIds });

    if (ctx.role === "client") {
      return NextResponse.json(projects.map(redactProjectForClient));
    }

    return NextResponse.json(projects);
  });
}

export async function POST(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const project = await createProject(await req.json());
    return NextResponse.json(project, { status: 201 });
  });
}
