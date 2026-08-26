/**
 * Single source of truth for the test database URL.
 *
 * Tests NEVER run against the development database: `tests/setup/env.ts`
 * overwrites DATABASE_URL with this value before any test module (and
 * therefore the Prisma client) is imported.
 */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/sprint_planner_test";
