ALTER TYPE "AccountingAuditEventType" ADD VALUE 'RECORD_PURGED';
ALTER TABLE public.account_recycle_records
 ADD COLUMN "purgedAt" TIMESTAMP(3),
 ADD COLUMN "purgeBlockedReason" VARCHAR(160),
 ADD COLUMN "purgeCheckedAt" TIMESTAMP(3);
