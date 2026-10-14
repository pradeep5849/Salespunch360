-- Paid recording and approval review are separate. Legacy rows remain unchanged.
CREATE TYPE "ExpenseApprovalReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "expense_transactions"
  ADD COLUMN "paidDate" DATE,
  ADD COLUMN "approvalReviewStatus" "ExpenseApprovalReviewStatus",
  ADD COLUMN "approvalReviewAt" TIMESTAMP(3),
  ADD COLUMN "approvalReviewById" UUID,
  ADD COLUMN "approvalReviewReason" VARCHAR(500);
CREATE INDEX "expense_transactions_companyId_approvalReviewStatus_branchId_idx"
  ON "expense_transactions"("companyId", "approvalReviewStatus", "branchId");
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_companyId_approvalReviewById_fkey"
  FOREIGN KEY ("companyId", "approvalReviewById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
