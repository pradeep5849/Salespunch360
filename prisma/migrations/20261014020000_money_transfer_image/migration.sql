-- Existing transfer IDs are primary keys; adding the declared company/ID key preserves all rows.
CREATE UNIQUE INDEX IF NOT EXISTS "money_transfers_companyId_id_key" ON "money_transfers"("companyId","id");
CREATE TABLE "money_transfer_images" (
 "id" UUID NOT NULL,
 "companyId" UUID NOT NULL,
 "transferId" UUID NOT NULL,
 "storageKey" VARCHAR(1000) NOT NULL,
 "displayName" VARCHAR(240) NOT NULL,
 "mimeType" VARCHAR(80) NOT NULL,
 "sizeBytes" INTEGER NOT NULL,
 "contentHash" VARCHAR(64) NOT NULL,
 "uploadedById" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "money_transfer_images_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "money_transfer_images_transfer_fkey" FOREIGN KEY ("companyId","transferId") REFERENCES "money_transfers"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "money_transfer_images_transferId_key" ON "money_transfer_images"("transferId");
CREATE INDEX "money_transfer_images_companyId_idx" ON "money_transfer_images"("companyId");
CREATE UNIQUE INDEX "money_transfer_images_companyId_transferId_key" ON "money_transfer_images"("companyId","transferId");
