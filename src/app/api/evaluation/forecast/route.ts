import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager, withRoute } from "@/lib/authorize";
import { evaluateAllCompletedSprints } from "@/services/forecast-evaluation.service";

/** Manager-only: model-calibration evidence across every project. */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    return NextResponse.json(await evaluateAllCompletedSprints());
  });
}
