import { NextRequest, NextResponse } from "next/server";
import {
  assertDeveloperSprintMembership,
  assertSprintAccess,
  forbidden,
  notFound,
  requireAuth,
  requireDeveloperIdentity,
  withRoute,
} from "@/lib/authorize";
import {
  computeSprintCapacity,
  computeSprintHealth,
  computeBurndown,
} from "@/services/overload-detection";
import { simulateAdHocTask } from "@/services/capacity.service";
import { personalCapacity } from "@/lib/redact";
import { prisma } from "@/lib/prisma";
import type { SprintCapacityResponse } from "@/types";

/**
 * Role-shaped:
 *  - manager   → capacity + health + burndown
 *  - developer → their own capacity row + burndown. `health` is withheld
 *                because `SprintHealth.recommendation` is a sentence naming
 *                the overloaded developers.
 *  - client    → burndown only. Note the client branch never calls
 *                `computeSprintCapacity`, which upserts `CapacityRecord` as a
 *                side effect — a client viewing a page must not write history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    await assertSprintAccess(ctx, id);

    const simulateDeveloperId = searchParams.get("simulateDeveloperId");
    const simulateHours = searchParams.get("simulateHours");

    if (simulateDeveloperId && simulateHours) {
      // The what-if simulator reveals another developer's headroom.
      if (ctx.role !== "manager") {
        throw forbidden("Capacity simulation is available to managers only.");
      }
      return NextResponse.json(
        await simulateAdHocTask(id, simulateDeveloperId, parseFloat(simulateHours))
      );
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: { tasks: true },
    });
    if (!sprint) throw notFound("Sprint not found");

    const burndown = computeBurndown(sprint, sprint.tasks);

    if (ctx.role === "client") {
      const body: SprintCapacityResponse = { burndown };
      return NextResponse.json(body);
    }

    if (ctx.role === "developer") {
      const developerId = requireDeveloperIdentity(ctx);
      await assertDeveloperSprintMembership(ctx, id);
      const all = await computeSprintCapacity(id);
      const mine = personalCapacity(all, developerId);
      const body: SprintCapacityResponse = {
        capacity: mine ? [mine] : [],
        burndown,
      };
      return NextResponse.json(body);
    }

    const capacity = await computeSprintCapacity(id);
    const body: SprintCapacityResponse = {
      capacity,
      health: computeSprintHealth(capacity),
      burndown,
    };
    return NextResponse.json(body);
  });
}
