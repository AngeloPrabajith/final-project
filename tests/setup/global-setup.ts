import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-db-url";

/**
 * Provision the test database before the suite:
 *   1. CREATE DATABASE sprint_planner_test (idempotent),
 *   2. prisma migrate deploy against it,
 *   3. full reseed via prisma/seed.ts (dates pivot around today, so the four
 *      historic sprints and three in-flight sprints are always in the same
 *      relative positions the assertions expect).
 *
 * Requires the Docker Postgres from `npm run db:up` to be running.
 */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const admin = new Client({
    connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`,
  });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "42P04") throw err; // 42P04 = already exists
  } finally {
    await admin.end();
  }

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env, stdio: "pipe" });
  // eslint-disable-next-line no-console
  console.log(`[global-setup] test database "${dbName}" migrated and reseeded`);
}
