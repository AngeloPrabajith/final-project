-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "capacityBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0.2;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium';
