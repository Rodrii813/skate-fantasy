-- CreateEnum
CREATE TYPE "ShowFormat" AS ENUM ('QUARTET', 'SMALL_GROUP', 'LARGE_GROUP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "showFormat" "ShowFormat";

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "splitLabel" TEXT,
ADD COLUMN     "splitScheduledAt" TIMESTAMP(3);
