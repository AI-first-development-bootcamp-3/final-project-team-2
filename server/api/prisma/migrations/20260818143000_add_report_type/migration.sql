-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('TOTAL_HOURS', 'CLOCK_IN_OUT');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "report_type" "ReportType" NOT NULL DEFAULT 'TOTAL_HOURS';
