-- AlterTable
ALTER TABLE "Segment" ADD COLUMN "opensAt" TIMESTAMP(3);
ALTER TABLE "Segment" ADD COLUMN "manuallyOpened" BOOLEAN NOT NULL DEFAULT false;
