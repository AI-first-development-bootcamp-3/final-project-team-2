-- AlterTable
-- One reported absence is stored as one row per contiguous run of working days
-- (VAL-43); every row from that report shares a group_id so edits and deletes
-- act on the whole group. Nullable: a row without one is a group of one.
ALTER TABLE "absences" ADD COLUMN "group_id" UUID;

-- AlterTable
-- Soft delete for attachments, matching every other record that carries
-- history (§8.3).
ALTER TABLE "absence_attachments" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "absences_user_id_group_id_idx" ON "absences"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "absences_user_id_start_date_idx" ON "absences"("user_id", "start_date");
