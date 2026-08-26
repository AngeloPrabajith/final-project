import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { normaliseRole, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * Authorisation layer.
 *
 * `src/lib/auth.ts` answers "is this a valid token?". This module answers
 * "what is this caller allowed to see and do?" — the role, the developer
 * profile they're linked to, and (for clients) the projects they may read.
 *
 * Deliberately NOT stored in the JWT: `developerId` and `projectIds` change
 * whenever a manager re-links an account or reassigns a project, and the token
 * lives 7 days with no refresh path. Resolving them per request costs one
 * indexed query and is always correct.
 */

export interface AuthContext {
  userId: string;
  email: string;
  /** Normalised — never compare against the raw JWT string. */
  role: Role;
  /** Linked `Developer.id`, or null when the account has no developer profile. */
  developerId: string | null;
  /** Assigned project ids for clients. `null` means unrestricted (manager/developer). */
  projectIds: string[] | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = () => new HttpError(401, "Unauthorized");
export const forbidden = (msg = "Forbidden") => new HttpError(403, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);

/**
 * Verify the token and resolve the caller's scope.
 * Costs at most one extra query: none for managers, one for developers,
 * one for clients.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const payload = authenticateRequest(req);
  if (!payload) throw unauthorized();

  const role = normaliseRole(payload.role);
  const base = { userId: payload.userId, email: payload.email, role };

  if (role === "manager") {
    return { ...base, developerId: null, projectIds: null };
  }

  if (role === "developer") {
    const dev = await prisma.developer.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });
    return { ...base, developerId: dev?.id ?? null, projectIds: null };
  }

  const grants = await prisma.projectClient.findMany({
    where: { userId: payload.userId },
    select: { projectId: true },
  });
  return {
    ...base,
    developerId: null,
    projectIds: grants.map((g) => g.projectId),
  };
}

export function requireRole(ctx: AuthContext, ...allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw forbidden(`This action requires: ${allowed.join(" or ")}.`);
  }
}

export function requireManager(ctx: AuthContext): void {
  requireRole(ctx, "manager");
}

/**
 * Resolve the caller's developer identity or refuse. An account with the
 * developer role but no linked `Developer` row can read nothing — fail closed
 * rather than silently widening to "all developers".
 */
export function requireDeveloperIdentity(ctx: AuthContext): string {
  if (ctx.role !== "developer") throw forbidden("Developer access only.");
  if (!ctx.developerId) {
    throw forbidden(
      "Your account isn't linked to a developer profile yet. Ask your project manager to link it."
    );
  }
  return ctx.developerId;
}

/** True when the caller's reads are limited to a fixed set of projects. */
export function isProjectScoped(ctx: AuthContext): ctx is AuthContext & {
  projectIds: string[];
} {
  return ctx.projectIds !== null;
}

export async function assertProjectAccess(
  ctx: AuthContext,
  projectId: string
): Promise<void> {
  if (!isProjectScoped(ctx)) return;
  if (!ctx.projectIds.includes(projectId)) {
    throw forbidden("You don't have access to this project.");
  }
}

/** Resolve a sprint to its project, then apply the same project check. */
export async function assertSprintAccess(
  ctx: AuthContext,
  sprintId: string
): Promise<string> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });
  if (!sprint) throw notFound("Sprint not found");
  await assertProjectAccess(ctx, sprint.projectId);
  return sprint.projectId;
}

/**
 * A developer may only read/mutate sprints they actually have work in.
 * Returns silently for managers.
 */
export async function assertDeveloperSprintMembership(
  ctx: AuthContext,
  sprintId: string
): Promise<void> {
  if (ctx.role !== "developer") return;
  const developerId = requireDeveloperIdentity(ctx);
  const count = await prisma.task.count({
    where: { sprintId, assignedDeveloperId: developerId },
  });
  if (count === 0) throw forbidden("You have no work in this sprint.");
}

/** A developer may only touch tasks assigned to them. */
export async function assertTaskOwnership(
  ctx: AuthContext,
  taskId: string
): Promise<void> {
  const developerId = requireDeveloperIdentity(ctx);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { assignedDeveloperId: true },
  });
  if (!task) throw notFound("Task not found");
  if (task.assignedDeveloperId !== developerId) {
    throw forbidden("This task isn't assigned to you.");
  }
}

/**
 * Wrap a route body so `HttpError`s become JSON responses and anything else
 * becomes a 500 without leaking internals. Keeps handlers flat.
 */
export async function withRoute(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
