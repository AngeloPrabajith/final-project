-- AlterTable
ALTER TABLE "Developer" ADD COLUMN "githubUsername" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "actualHours" DOUBLE PRECISION,
                   ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeveloperActivity" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "pullRequestCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_githubUsername_key" ON "Developer"("githubUsername");

-- CreateIndex
CREATE INDEX "DeveloperActivity_developerId_activityDate_idx" ON "DeveloperActivity"("developerId", "activityDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperActivity_source_externalRef_key" ON "DeveloperActivity"("source", "externalRef");

-- AddForeignKey
ALTER TABLE "DeveloperActivity" ADD CONSTRAINT "DeveloperActivity_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
