ALTER TABLE "mobile_sessions"
  ADD COLUMN "webHandoffCodeHash" CHAR(64),
  ADD COLUMN "webHandoffExpiresAt" TIMESTAMP(3),
  ADD COLUMN "webHandoffRedirectPath" TEXT;

ALTER TABLE "sessions" ADD COLUMN "mobileSessionId" UUID;

CREATE UNIQUE INDEX "mobile_sessions_webHandoffCodeHash_key" ON "mobile_sessions"("webHandoffCodeHash");
CREATE UNIQUE INDEX "sessions_mobileSessionId_key" ON "sessions"("mobileSessionId");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mobileSessionId_fkey"
  FOREIGN KEY ("mobileSessionId") REFERENCES "mobile_sessions"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
