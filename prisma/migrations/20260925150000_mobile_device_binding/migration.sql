CREATE TABLE "mobile_device_bindings" (
    "userId" UUID NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "deviceName" VARCHAR(160),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_device_bindings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "mobile_device_bindings"
ADD CONSTRAINT "mobile_device_bindings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE RESTRICT;
