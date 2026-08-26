import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireDeveloperIdentity,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import { getAllTasks, createTask } from "@/services/task.service";
import { redactTaskForClient } from "@/lib/redact";

/**
 * `sprintId` is a caller-supplied filter; the developer/client scope is
 * server-derived. `getAllTasks` ANDs them — see the note there.
 */
export async function GET(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const sprintId = searchParams.get("sprintId") || undefined;

    if (ctx.role === "developer") {
      const developerId = requireDeveloperIdentity(ctx);
      return NextResponse.json(await getAllTasks(sprintId, { developerId }));
    }

    if (ctx.role === "client") {
      const tasks = await getAllTasks(sprintId, { projectIds: ctx.projectIds });
      return NextResponse.json(tasks.map(redactTaskForClient));
    }

    return NextResponse.json(await getAllTasks(sprintId));
  });
}

export async function POST(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);
    const task = await createTask(await req.json());
    return NextResponse.json(task, { status: 201 });
  });
}
