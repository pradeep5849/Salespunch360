DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "customer_visits" WHERE "checkedOutAt" IS NULL GROUP BY "companyId","userId" HAVING COUNT(*)>1) THEN
  RAISE EXCEPTION 'W5A migration blocked: duplicate historical open customer visits must be resolved explicitly';
 END IF;
END $$;
CREATE TABLE "pending_storage_deletions" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "objectKey" VARCHAR(500) NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "lastAttemptAt" TIMESTAMP(3), "lastError" VARCHAR(100),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "pending_storage_deletions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "pending_storage_deletions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "pending_storage_deletions_objectKey_key" ON "pending_storage_deletions"("objectKey");
CREATE INDEX "pending_storage_deletions_createdAt_idx" ON "pending_storage_deletions"("createdAt");
CREATE TABLE "lead_deletion_audits" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "actorUserId" UUID NOT NULL,
 "deletedLeadId" UUID NOT NULL, "visitsDeleted" INTEGER NOT NULL, "photosQueued" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "lead_deletion_audits_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "lead_deletion_audits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "lead_deletion_audits_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "lead_deletion_audits_companyId_createdAt_idx" ON "lead_deletion_audits"("companyId","createdAt");
