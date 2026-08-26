import { NextRequest, NextResponse } from "next/server";
import {
  assertSprintAccess,
  forbidden,
  requireAuth,
  withRoute,
} from "@/lib/authorize";
import { computeSprintForecast } from "@/services/sprint-forecast.service";
import { deliveryConfidenceFor } from "@/lib/redact";

/**
 * Managers get the full forecast. Clients get a band and a label only.
 *
 * The full object cannot be handed to a client with a few fields removed:
 * `headline` reads "74% chance this sprint misses commitment", every
 * `contributor.detail` is a sentence built by the forecast service with
 * developer names interpolated in, and `adjustedAnalyses` is per-developer
 * utilisation. Only the risk band survives redaction.
 *
 * Developers get 403 — a sprint-level failure probability is a planning
 * signal for whoever owns the plan, and exposing "your sprint is 74% likely to
 * fail" to individuals is a management decision, not a default.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    if (ctx.role === "developer") {
      throw forbidden("Sprint forecasts are available to managers only.");
    }

    await assertSprintAccess(ctx, id);
    // Clients read without persisting — a client viewing their delivery page
    // must not write CapacityRecord history as a side effect.
    const forecast = await computeSprintForecast(id, {
      persist: ctx.role === "manager",
    });

    if (ctx.role === "client") {
      return NextResponse.json(deliveryConfidenceFor(forecast.riskBand));
    }

    return NextResponse.json(forecast);
  });
}
