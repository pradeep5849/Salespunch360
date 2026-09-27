CREATE TABLE "field_jobs" (
 "id" UUID NOT NULL PRIMARY KEY,
 "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "key" VARCHAR(160) NOT NULL,
 "kind" VARCHAR(30) NOT NULL,
 "payload" JSONB NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "leaseToken" UUID, "completedAt" TIMESTAMP(3),
 "lastError" VARCHAR(80), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "field_jobs_key_key" ON "field_jobs"("key");
CREATE INDEX "field_jobs_completedAt_nextAttemptAt_lockedUntil_idx" ON "field_jobs"("completedAt","nextAttemptAt","lockedUntil");
CREATE INDEX "field_jobs_companyId_idx" ON "field_jobs"("companyId");
