import { TEST_DATABASE_URL } from "./test-db-url";

// Runs before each test file is imported. Point every Prisma client at the
// test database and pin a deterministic JWT secret for route-handler tests.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "vitest-secret";
