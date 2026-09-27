CREATE TABLE "sales_notifications" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "actorUserId" UUID,
  "eventType" VARCHAR(80) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "relatedEntityType" VARCHAR(50),
  "relatedEntityId" UUID,
  "navigationTarget" VARCHAR(500),
  "dedupeKey" VARCHAR(220) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "sales_notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "sales_notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "sales_notifications_recipientUserId_dedupeKey_key" ON "sales_notifications"("recipientUserId", "dedupeKey");
CREATE INDEX "sales_notifications_companyId_recipientUserId_createdAt_idx" ON "sales_notifications"("companyId", "recipientUserId", "createdAt");
CREATE INDEX "sales_notifications_companyId_recipientUserId_readAt_createdAt_idx" ON "sales_notifications"("companyId", "recipientUserId", "readAt", "createdAt");
CREATE INDEX "sales_notifications_recipientUserId_readAt_idx" ON "sales_notifications"("recipientUserId", "readAt");
