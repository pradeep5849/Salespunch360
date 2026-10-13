-- Keep existing bank data and global invoice settings; new per-account opt-ins default OFF.
ALTER TABLE "money_accounts"
 ADD COLUMN "accountHolderName" VARCHAR(160),
 ADD COLUMN "bankBranchName" VARCHAR(160),
 ADD COLUMN "upiId" VARCHAR(322),
 ADD COLUMN "printBankDetails" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "printUpiQr" BOOLEAN NOT NULL DEFAULT false;
