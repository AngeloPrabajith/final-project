-- Role-based access: link logins to developer records, scope clients to projects.
--
-- Data note: before this migration the only role values in the wild were
-- 'admin' (admin@sprintplanner.com) and 'user' (lead@sprintplanner.com). Both
-- denoted an account that could see and do everything, so both become
-- 'manager'. The column default also changes from 'user' to 'developer' —
-- without that, every self-registered account would inherit a manager role via
-- the legacy alias, which is a privilege-escalation hole.

-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ProjectClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectClient_userId_idx" ON "ProjectClient"("userId");

-- CreateIndex
CREATE INDEX "ProjectClient_projectId_idx" ON "ProjectClient"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClient_userId_projectId_key" ON "ProjectClient"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_userId_key" ON "Developer"("userId");

-- AddForeignKey
ALTER TABLE "Developer" ADD CONSTRAINT "Developer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClient" ADD CONSTRAINT "ProjectClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClient" ADD CONSTRAINT "ProjectClient_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill legacy role values before the default changes.
UPDATE "User" SET "role" = 'manager' WHERE "role" IN ('admin', 'user');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'developer';
