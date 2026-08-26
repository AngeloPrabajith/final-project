import { describe, expect, it } from "vitest";
import { landingPathFor, normaliseRole, ROLES } from "@/lib/roles";

describe("role normalisation — plain string + aliases instead of a DB enum", () => {
  // Handbook §10.8: legacy rows and 8h JWTs minted before the role model said
  // "admin" / "user"; both denoted full access, so both alias to manager.
  it("maps the legacy admin role to manager", () => {
    expect(normaliseRole("admin")).toBe("manager");
  });

  it("maps the legacy user role to manager", () => {
    expect(normaliseRole("user")).toBe("manager");
  });

  it("maps lead to manager and dev to developer", () => {
    expect(normaliseRole("lead")).toBe("manager");
    expect(normaliseRole("dev")).toBe("developer");
  });

  it("accepts the canonical three unchanged", () => {
    for (const role of ROLES) expect(normaliseRole(role)).toBe(role);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normaliseRole("  ADMIN  ")).toBe("manager");
    expect(normaliseRole("Developer")).toBe("developer");
    expect(normaliseRole("CLIENT")).toBe("client");
  });

  // Handbook §5: a typo or tampered token must fail CLOSED — the unknown
  // value collapses to the least-privileged role, never to manager.
  it("fails closed: unknown, empty, null and undefined all collapse to client", () => {
    expect(normaliseRole("superadmin")).toBe("client");
    expect(normaliseRole("")).toBe("client");
    expect(normaliseRole(null)).toBe("client");
    expect(normaliseRole(undefined)).toBe("client");
  });
});

describe("post-login landing per role", () => {
  it("routes manager to /dashboard, developer to /my-work, client to /portfolio", () => {
    expect(landingPathFor("manager")).toBe("/dashboard");
    expect(landingPathFor("developer")).toBe("/my-work");
    expect(landingPathFor("client")).toBe("/portfolio");
  });
});
