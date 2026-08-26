/**
 * Role vocabulary for the three-role access model.
 *
 * Deliberately a plain string in the database rather than a Prisma enum:
 *  - the JWT carries `role` as a string and lives 7 days with no refresh path,
 *    so tokens minted before this change still say `"admin"`. Normalising at
 *    read time keeps those sessions working instead of forcing a mass logout.
 *  - a Prisma enum migration (`USING role::"Role"`) fails outright on any row
 *    whose value isn't a member, and the live rows were `admin` / `user`.
 *  - an enum cannot express aliasing, which is the actual requirement here.
 */

export type Role = "manager" | "developer" | "client";

export const ROLES: Role[] = ["manager", "developer", "client"];

/**
 * Accepted spellings mapped onto the canonical three. `admin` and `user` are
 * the legacy values seeded before roles meant anything — both denoted an
 * account that could see and do everything, i.e. a manager.
 */
const ALIASES: Record<string, Role> = {
  admin: "manager",
  manager: "manager",
  lead: "manager",
  user: "manager",
  developer: "developer",
  dev: "developer",
  client: "client",
};

/**
 * Normalise a raw role string. Unknown values collapse to `client` — the
 * least-privileged role — so a typo or a tampered token fails closed rather
 * than granting access.
 */
export function normaliseRole(raw: string | null | undefined): Role {
  return ALIASES[(raw ?? "").trim().toLowerCase()] ?? "client";
}

/** Where each role lands after login and at `/`. */
export function landingPathFor(role: Role): string {
  if (role === "manager") return "/dashboard";
  if (role === "developer") return "/my-work";
  return "/portfolio";
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: "Project Manager",
  developer: "Developer",
  client: "Client",
};
