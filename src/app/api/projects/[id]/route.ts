import { NextRequest, NextResponse } from "next/server";
import {
  assertProjectAccess,
  notFound,
  requireAuth,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import {
  getProjectById,
  updateProject,
  deleteProject,
} from "@/services/project.service";
import { redactProjectForClient } from "@/lib/redact";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;
    await assertProjectAccess(ctx, id);

    const project = await getProjectById(id);
    if (!project) throw notFound("Project not found");

    // Sprints carry `retrospectiveNotes` — manager-authored free text that
    // routinely names and evaluates individuals. Share one whitelist with the
    // list route so the two cannot drift apart.
    if (ctx.role !== "manager") {
      return NextResponse.json(redactProjectForClient(project));
    }

    return NextResponse.json(project);
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const { id } = await params;
    return NextResponse.json(await updateProject(id, await req.json()));
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const { id } = await params;
    await deleteProject(id);
    return NextResponse.json({ success: true });
  });
}
