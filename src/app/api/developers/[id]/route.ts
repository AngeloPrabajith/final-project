import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  notFound,
  requireAuth,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import {
  getDeveloperById,
  updateDeveloper,
  deleteDeveloper,
} from "@/services/developer.service";

/** Managers read anyone; a developer reads only their own profile. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    if (ctx.role !== "manager" && id !== ctx.developerId) {
      throw forbidden("You can only view your own developer profile.");
    }

    const developer = await getDeveloperById(id);
    if (!developer) throw notFound("Developer not found");
    return NextResponse.json(developer);
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
    return NextResponse.json(await updateDeveloper(id, await req.json()));
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
    await deleteDeveloper(id);
    return NextResponse.json({ success: true });
  });
}
