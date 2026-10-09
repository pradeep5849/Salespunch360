-- Retain authorized deletion jobs after tenant deletion; no existing jobs are discarded.
ALTER TABLE "pending_storage_deletions" DROP CONSTRAINT "pending_storage_deletions_companyId_fkey";
ALTER TABLE "pending_storage_deletions" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "pending_storage_deletions" ADD CONSTRAINT "pending_storage_deletions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
