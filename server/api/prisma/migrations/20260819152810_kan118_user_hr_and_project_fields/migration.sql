-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('worker', 'manager');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "description" TEXT,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "lead_manager_id" UUID,
ADD COLUMN     "start_date" DATE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_number" VARCHAR(50),
ADD COLUMN     "employment_percent" INTEGER,
ADD COLUMN     "employment_type" "EmploymentType",
ADD COLUMN     "org_unit" VARCHAR(255),
ADD COLUMN     "role_title" VARCHAR(255);

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_manager_id_fkey" FOREIGN KEY ("lead_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
