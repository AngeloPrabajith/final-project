import { NextRequest, NextResponse } from "next/server";
import {
  assertProjectAccess,
  forbidden,
  requireAuth,
  withRoute,
} from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

/**
 * Planned-vs-completed hours per sprint. The payload is already free of
 * per-person data, so clients get it unchanged once project access checks out
 * — this is the one analytics endpoint that needs no redaction at all.
 *
 * Developers get 403: project-level velocity is a management view, and their
 * own throughput is already on "My Work".
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    if (ctx.role === "developer") {
      throw forbidden("Project velocity is available to managers and clients.");
    }
    await assertProjectAccess(ctx, id);

    const sprints = await prisma.sprint.findMany({
      where: { projectId: id },
      include: { tasks: true },
      orderBy: { startDate: "asc" },
    });

    const velocity = sprints.map((sprint) => {
      const totalHours = sprint.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      const completedHours = sprint.tasks
        .filter((t) => t.status === "done")
        .reduce((sum, t) => sum + t.estimatedHours, 0);
      const completionRate =
        totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        totalHours,
        completedHours,
        completionRate,
      };
    });

    return NextResponse.json(velocity);
  });
}
