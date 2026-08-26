import { NextRequest, NextResponse } from "next/server";
import {
  assertDeveloperSprintMembership,
  assertSprintAccess,
  notFound,
  requireAuth,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import {
  getSprintById,
  updateSprint,
  deleteSprint,
} from "@/services/sprint.service";
import { redactSprintForClient } from "@/lib/redact";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    // Clients: must own the project. Developers: must have work in the sprint.
    await assertSprintAccess(ctx, id);
    await assertDeveloperSprintMembership(ctx, id);

    const sprint = await getSprintById(
      id,
      ctx.role === "developer" ? { developerId: ctx.developerId } : {}
    );
    if (!sprint) throw notFound("Sprint not found");

    if (ctx.role === "client") {
      return NextResponse.json(redactSprintForClient(sprint));
    }

    if (ctx.role === "developer") {
      // Tasks are already pruned to theirs by the scope above; strip the
      // manager-authored retrospective, which evaluates named individuals.
      const { retrospectiveNotes: _ignored, ...rest } = sprint;
      void _ignored;
      return NextResponse.json(rest);
    }

    return NextResponse.json(sprint);
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
    return NextResponse.json(await updateSprint(id, await req.json()));
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
    await deleteSprint(id);
    return NextResponse.json({ success: true });
  });
}
