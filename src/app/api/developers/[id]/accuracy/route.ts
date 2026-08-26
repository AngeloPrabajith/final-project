import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAuth, withRoute } from "@/lib/authorize";
import { computeDeveloperAccuracy } from "@/services/estimation-accuracy.service";

/**
 * Managers may read anyone's factor. A developer may read exactly their own —
 * the self carve-out is what makes the "My Work" accuracy card possible
 * without opening the whole team's estimation history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    if (ctx.role !== "manager" && id !== ctx.developerId) {
      throw forbidden("You can only view your own estimation accuracy.");
    }

    const { searchParams } = new URL(req.url);
    const windowDaysParam = searchParams.get("windowDays");
    const windowDays = windowDaysParam ? parseInt(windowDaysParam, 10) : undefined;

    return NextResponse.json(await computeDeveloperAccuracy(id, { windowDays }));
  });
}
