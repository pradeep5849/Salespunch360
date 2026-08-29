CREATE TABLE "rate_limit_buckets" ("key" VARCHAR(128) PRIMARY KEY,"count" INTEGER NOT NULL,"resetsAt" TIMESTAMP(3) NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "rate_limit_count_check" CHECK("count">=0));
CREATE INDEX "rate_limit_buckets_resets_idx" ON "rate_limit_buckets"("resetsAt");
