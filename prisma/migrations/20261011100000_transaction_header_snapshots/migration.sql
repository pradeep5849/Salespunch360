ALTER TABLE "commercial_documents"
  ADD COLUMN "billingName" VARCHAR(240),
  ADD COLUMN "customerPoNumber" VARCHAR(100),
  ADD COLUMN "customerPoDate" DATE,
  ADD COLUMN "transactionTime" VARCHAR(8),
  ADD COLUMN "ewayBillNumber" VARCHAR(12);

ALTER TABLE "commercial_documents"
  ADD CONSTRAINT "commercial_transaction_time_valid" CHECK (
    "transactionTime" IS NULL OR "transactionTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
  ),
  ADD CONSTRAINT "commercial_eway_number_valid" CHECK (
    "ewayBillNumber" IS NULL OR "ewayBillNumber" ~ '^[0-9]{12}$'
  );
