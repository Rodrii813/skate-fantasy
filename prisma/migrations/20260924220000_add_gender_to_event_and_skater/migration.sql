-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "Skater" ADD COLUMN     "gender" "Gender";

