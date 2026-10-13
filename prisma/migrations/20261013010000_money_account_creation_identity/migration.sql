ALTER TABLE "money_accounts" ADD COLUMN "creationRequestKey" UUID, ADD COLUMN "creationRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "money_accounts_companyId_creationRequestKey_key" ON "money_accounts"("companyId", "creationRequestKey");
ALTER TABLE "money_accounts" ADD CONSTRAINT "money_accounts_creation_identity_pair" CHECK (("creationRequestKey" IS NULL) = ("creationRequestHash" IS NULL));
