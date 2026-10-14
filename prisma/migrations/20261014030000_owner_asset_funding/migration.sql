-- Add attribution history without modifying asset cost, original contributions or journals.
CREATE UNIQUE INDEX IF NOT EXISTS "assets_companyId_id_key" ON "assets"("companyId","id");
CREATE UNIQUE INDEX IF NOT EXISTS "owner_financial_accounts_companyId_id_key" ON "owner_financial_accounts"("companyId","id");
CREATE UNIQUE INDEX IF NOT EXISTS "owner_transactions_companyId_id_key" ON "owner_transactions"("companyId","id");
CREATE TABLE "asset_owner_fundings" (
 "id" UUID NOT NULL PRIMARY KEY, "companyId" UUID NOT NULL, "branchId" UUID NOT NULL,
 "assetId" UUID NOT NULL, "ownerFinancialAccountId" UUID NOT NULL, "contributionTransactionId" UUID NOT NULL,
 "amount" DECIMAL(18,2) NOT NULL CHECK ("amount">0), "allocationDate" DATE NOT NULL, "requestKey" UUID NOT NULL,
 "createdById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyId","assetId") REFERENCES "assets"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("companyId","ownerFinancialAccountId") REFERENCES "owner_financial_accounts"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("companyId","contributionTransactionId") REFERENCES "owner_transactions"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "asset_owner_fundings_companyId_id_key" ON "asset_owner_fundings"("companyId","id");
CREATE UNIQUE INDEX "asset_owner_fundings_companyId_requestKey_key" ON "asset_owner_fundings"("companyId","requestKey");
CREATE INDEX "asset_owner_fundings_companyId_branchId_assetId_idx" ON "asset_owner_fundings"("companyId","branchId","assetId");
CREATE TABLE "asset_owner_funding_cancellations" (
 "id" UUID NOT NULL PRIMARY KEY, "companyId" UUID NOT NULL, "fundingId" UUID NOT NULL,
 "reason" VARCHAR(1000) NOT NULL, "requestKey" UUID NOT NULL, "createdById" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyId","fundingId") REFERENCES "asset_owner_fundings"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "asset_owner_funding_cancellations_fundingId_key" ON "asset_owner_funding_cancellations"("fundingId");
CREATE UNIQUE INDEX "asset_owner_funding_cancellations_companyId_fundingId_key" ON "asset_owner_funding_cancellations"("companyId","fundingId");
CREATE UNIQUE INDEX "asset_owner_funding_cancellations_companyId_requestKey_key" ON "asset_owner_funding_cancellations"("companyId","requestKey");
CREATE TABLE "owner_asset_funding_returns" (
 "id" UUID NOT NULL PRIMARY KEY, "companyId" UUID NOT NULL, "fundingId" UUID NOT NULL,
 "ownerTransactionId" UUID NOT NULL, "amount" DECIMAL(18,2) NOT NULL CHECK ("amount">0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyId","fundingId") REFERENCES "asset_owner_fundings"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("companyId","ownerTransactionId") REFERENCES "owner_transactions"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "owner_asset_funding_returns_companyId_ownerTransactionId_fundingId_key" ON "owner_asset_funding_returns"("companyId","ownerTransactionId","fundingId");
CREATE INDEX "owner_asset_funding_returns_companyId_fundingId_idx" ON "owner_asset_funding_returns"("companyId","fundingId");
CREATE TABLE "asset_funding_confirmations" (
 "id" UUID NOT NULL PRIMARY KEY, "companyId" UUID NOT NULL, "branchId" UUID NOT NULL, "assetId" UUID NOT NULL,
 "costBasis" DECIMAL(18,2) NOT NULL CHECK ("costBasis">=0), "confirmed" BOOLEAN NOT NULL,
 "revision" INTEGER NOT NULL CHECK ("revision">0), "reason" VARCHAR(1000) NOT NULL, "requestKey" UUID NOT NULL,
 "createdById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyId","assetId") REFERENCES "assets"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "asset_funding_confirmations_companyId_requestKey_key" ON "asset_funding_confirmations"("companyId","requestKey");
CREATE UNIQUE INDEX "asset_funding_confirmations_companyId_assetId_revision_key" ON "asset_funding_confirmations"("companyId","assetId","revision");
