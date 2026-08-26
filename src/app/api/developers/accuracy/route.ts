import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager, withRoute } from "@/lib/authorize";
import { computeAllAccuracies } from "@/services/estimation-accuracy.service";

/**
 * Manager-only: this returns every developer's estimation bias. A developer
 * reads their own factor via `/api/developers/[id]/accuracy`; nobody else
 * sees the whole team's.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);

    const { searchParams } = new URL(req.url);
    const windowDaysParam = searchParams.get("windowDays");
    const windowDays = windowDaysParam ? parseInt(windowDaysParam, 10) : undefined;

    return NextResponse.json(await computeAllAccuracies({ windowDays }));
  });
}
