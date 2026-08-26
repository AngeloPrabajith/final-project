import { NextRequest, NextResponse } from "next/server";
import {
  assertProjectAccess,
  assertTaskOwnership,
  forbidden,
  notFound,
  requireAuth,
  requireManager,
  withRoute,
} from "@/lib/authorize";
import { getTaskById, updateTask, deleteTask } from "@/services/task.service";
import {
  DEVELOPER_TASK_UPDATE_FIELDS,
  disallowedDeveloperTaskFields,
  redactTaskForClient,
} from "@/lib/redact";
import type { UpdateTaskInput } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;

    const task = await getTaskById(id);
    if (!task) throw notFound("Task not found");

    if (ctx.role === "developer") {
      if (task.assignedDeveloperId !== ctx.developerId) {
        throw forbidden("This task isn't assigned to you.");
      }
      return NextResponse.json(task);
    }

    if (ctx.role === "client") {
      await assertProjectAccess(ctx, task.sprint.projectId);
      return NextResponse.json(redactTaskForClient(task));
    }

    return NextResponse.json(task);
  });
}

/**
 * Managers may change anything. A developer may change only `status`,
 * `actualHours` and `completedAt`, and only on their own task — the two things
 * "My Work" needs. Anything else is rejected with a 403 rather than silently
 * dropped, so an attempt to reassign work to a colleague fails loudly.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (ctx.role !== "manager") {
      await assertTaskOwnership(ctx, id);
      const rejected = disallowedDeveloperTaskFields(body);
      if (rejected.length > 0) {
        throw forbidden(
          `You may only update ${DEVELOPER_TASK_UPDATE_FIELDS.join(", ")} on your own tasks. Rejected: ${rejected.join(", ")}.`
        );
      }
    }

    return NextResponse.json(await updateTask(id, body as UpdateTaskInput));
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
    await deleteTask(id);
    return NextResponse.json({ success: true });
  });
}
