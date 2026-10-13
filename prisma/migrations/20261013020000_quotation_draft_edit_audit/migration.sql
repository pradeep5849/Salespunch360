-- Add the distinct draft-edit event without rewriting any existing audit history.
ALTER TYPE "QuotationAuditEventType" ADD VALUE IF NOT EXISTS 'DRAFT_UPDATED';
