CREATE TYPE "PushPlatform" AS ENUM ('ANDROID');

CREATE TABLE "push_devices" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "mobileSessionId" UUID NOT NULL,
  "installationId" VARCHAR(128) NOT NULL,
  "fcmToken" VARCHAR(4096) NOT NULL,
  "platform" "PushPlatform" NOT NULL DEFAULT 'ANDROID',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_devices_installationId_key" ON "push_devices"("installationId");
CREATE UNIQUE INDEX "push_devices_fcmToken_key" ON "push_devices"("fcmToken");
CREATE INDEX "push_devices_companyId_userId_idx" ON "push_devices"("companyId", "userId");
CREATE INDEX "push_devices_mobileSessionId_idx" ON "push_devices"("mobileSessionId");
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_mobileSessionId_fkey" FOREIGN KEY ("mobileSessionId") REFERENCES "mobile_sessions"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
