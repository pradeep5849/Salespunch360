-- Normalize party opening receivables/payables as settlement targets only.
-- Existing OPENING_BALANCE journal entries remain the sole accounting posting.
CREATE TABLE "party_opening_balances" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "branchId" UUID NOT NULL,
 "partyType" VARCHAR(16) NOT NULL, "partyId" UUID NOT NULL, "partyName" VARCHAR(240) NOT NULL,
 "effectiveDate" DATE NOT NULL, "amount" DECIMAL(18,2) NOT NULL,
 "journalEntryId" UUID NOT NULL, "createdById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "party_opening_balances_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "party_opening_balances_partyType_check" CHECK ("partyType" IN ('CUSTOMER','VENDOR')),
 CONSTRAINT "party_opening_balances_amount_check" CHECK ("amount" > 0),
 CONSTRAINT "party_opening_balances_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "party_opening_balances_branch_fkey" FOREIGN KEY ("companyId","branchId") REFERENCES "branches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "party_opening_balances_journal_fkey" FOREIGN KEY ("companyId","journalEntryId") REFERENCES "journal_entries"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "party_opening_balances_creator_fkey" FOREIGN KEY ("companyId","createdById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "party_opening_balances_companyId_journalEntryId_partyType_partyId_key" ON "party_opening_balances"("companyId","journalEntryId","partyType","partyId");
CREATE INDEX "party_opening_balances_companyId_branchId_partyType_partyId_effectiveDate_idx" ON "party_opening_balances"("companyId","branchId","partyType","partyId","effectiveDate");
CREATE TABLE "opening_balance_allocations" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "settlementId" UUID NOT NULL,
 "openingBalanceId" UUID NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "opening_balance_allocations_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "opening_balance_allocations_amount_check" CHECK ("amount" > 0),
 CONSTRAINT "opening_balance_allocations_settlement_fkey" FOREIGN KEY ("companyId","settlementId") REFERENCES "account_settlements"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "opening_balance_allocations_opening_fkey" FOREIGN KEY ("openingBalanceId") REFERENCES "party_opening_balances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "opening_balance_allocations_companyId_settlementId_openingBalanceId_key" ON "opening_balance_allocations"("companyId","settlementId","openingBalanceId");
CREATE INDEX "opening_balance_allocations_companyId_openingBalanceId_idx" ON "opening_balance_allocations"("companyId","openingBalanceId");
