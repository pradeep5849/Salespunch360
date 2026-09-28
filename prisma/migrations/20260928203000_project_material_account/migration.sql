-- Add the Project Material/WIP posting account without changing existing ledgers.
INSERT INTO "ledger_accounts" ("id","companyId","code","name","accountClass","normalBalance","systemKey","isSystem","allowPosting","isActive","createdAt","updatedAt")
SELECT gen_random_uuid(), c."id", '1450', 'Project Material / WIP', 'ASSET'::"LedgerAccountClass", 'DEBIT'::"NormalBalanceSide", 'PROJECT_MATERIAL_WIP', true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (SELECT 1 FROM "ledger_accounts" a WHERE a."companyId"=c."id" AND a."systemKey"='PROJECT_MATERIAL_WIP');
