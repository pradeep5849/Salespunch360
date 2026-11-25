CREATE TABLE "web_push_devices" (
 "id" UUID NOT NULL,
 "companyId" UUID NOT NULL,
 "userId" UUID NOT NULL,
 "sessionId" UUID NOT NULL,
 "fcmToken" VARCHAR(4096) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "web_push_devices_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "web_push_devices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "web_push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "web_push_devices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "web_push_devices_fcmToken_key" ON "web_push_devices"("fcmToken");
CREATE INDEX "web_push_devices_companyId_userId_idx" ON "web_push_devices"("companyId","userId");
CREATE INDEX "web_push_devices_sessionId_idx" ON "web_push_devices"("sessionId");
