-- The original source-file hash remains in metadata after preview-plan identity
-- separates update/skip choices. Serialize execution by company and efficiently
-- reject a second business-changing execution of the same source bytes.
CREATE INDEX "account_import_jobs_source_replay_idx" ON "account_import_jobs"("companyId","importType",(metadata->>'fileHash')) WHERE status IN ('COMPLETED','PARTIAL');
