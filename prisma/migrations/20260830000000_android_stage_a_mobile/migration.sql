CREATE TABLE "mobile_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_sessions_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "mobile_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "mobile_sessions_tokenHash_key" ON "mobile_sessions"("tokenHash");
CREATE INDEX "mobile_sessions_userId_revokedAt_idx" ON "mobile_sessions"("userId", "revokedAt");
CREATE INDEX "mobile_sessions_expiresAt_idx" ON "mobile_sessions"("expiresAt");

ALTER TABLE "location_points" ADD COLUMN "clientPointId" UUID;
CREATE UNIQUE INDEX "location_points_companyId_userId_clientPointId_key" ON "location_points"("companyId", "userId", "clientPointId");
