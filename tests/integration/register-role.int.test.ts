import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as register } from "@/app/api/auth/register/route";

const email = `pin-role-${Date.now()}@test.local`;

function registerRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
});

describe("registration endpoint — role pinned server-side", () => {
  // Handbook §5: self-registration always creates an UNLINKED developer;
  // client and manager accounts are never self-service. The role in the body
  // must be ignored, or any visitor could mint themselves a manager account.
  it("creates a developer even when the request body claims to be a manager", async () => {
    const res = await register(
      registerRequest({ name: "Escalation Attempt", email, password: "password123", role: "manager" })
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { user: { role: string } };
    expect(payload.user.role).toBe("developer");

    const row = await prisma.user.findUnique({ where: { email } });
    expect(row?.role).toBe("developer");
  });

  it("leaves the new account unlinked to any developer profile (fail-closed until a manager links it)", async () => {
    const row = await prisma.user.findUnique({
      where: { email },
      include: { developer: true },
    });
    expect(row?.developer).toBeNull();
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await register(
      registerRequest({ name: "Dup", email, password: "password123" })
    );
    expect(res.status).toBe(409);
  });

  it("rejects a submission missing required fields with 400", async () => {
    const res = await register(registerRequest({ email: "half@test.local" }));
    expect(res.status).toBe(400);
  });
});
