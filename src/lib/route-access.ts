import type { Role } from "@/lib/roles";

/**
 * Which roles may open which page.
 *
 * This is **not** a security boundary — the API is. Every endpoint enforces
 * its own rules server-side, so a user who forces their way onto a page they
 * shouldn't see gets an empty screen and a pile of 403s, not data. What this
 * map buys is a coherent UI: nobody is shown a route that will only frustrate
 * them.
 *
 * Longest matching prefix wins, so `/projects/[id]` inherits `/projects`.
 */
const ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/dashboard", roles: ["manager"] },
  { prefix: "/developers", roles: ["manager"] },
  { prefix: "/capacity", roles: ["manager"] },
  { prefix: "/evaluation", roles: ["manager"] },
  { prefix: "/projects", roles: ["manager"] },
  { prefix: "/sprints", roles: ["manager"] },
  { prefix: "/admin", roles: ["manager"] },
  { prefix: "/my-work", roles: ["developer"] },
  { prefix: "/portfolio", roles: ["client"] },
  // Open to everyone signed in.
  { prefix: "/settings", roles: ["manager", "developer", "client"] },
  { prefix: "/", roles: ["manager", "developer", "client"] },
];

export function rolesForPath(pathname: string): Role[] {
  const match = ROUTE_ROLES.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.roles ?? ["manager", "developer", "client"];
}

export function canAccess(role: Role, pathname: string): boolean {
  return rolesForPath(pathname).includes(role);
}
