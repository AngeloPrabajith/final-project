import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager, withRoute } from "@/lib/authorize";
import { getAllDevelopers, createDeveloper } from "@/services/developer.service";

/**
 * Manager-only. The roster carries weekly capacity and meeting load for every
 * person — the raw material of the capacity model, and not something a peer
 * or an external client has any reason to read.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    return NextResponse.json(await getAllDevelopers());
  });
}

export async function POST(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const developer = await createDeveloper(await req.json());
    return NextResponse.json(developer, { status: 201 });
  });
}
