-- Add the enum value only. PostgreSQL requires a commit before the new enum value can be used.
ALTER TYPE "BillingRole" ADD VALUE IF NOT EXISTS 'ACCOUNT_PACKAGE';
