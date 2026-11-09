"use server";
import {
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { receiptEntryReviewForActor } from "@/lib/account/receipt-entry-review";
import { createMoneyAccountForActor } from "@/lib/account/money";
import { z } from "zod";
export async function receiptEntryReview(
  branchId: string,
  customerId?: string,
) {
  const a = await requirePermission("ACCOUNT_SETTLEMENT_ENTRY");
  return receiptEntryReviewForActor(
    { ...a, companyId: a.companyId! },
    { branchId, ...(customerId ? { customerId } : {}) },
  );
}
export async function createReceiptMoneyAccount(raw: unknown) {
  const a = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      type: z.enum(["CASH", "BANK"]),
      branchId: z.string().uuid(),
      creationRequestKey: z.string().uuid(),
    })
    .strict()
    .parse(raw);
  const row = await createMoneyAccountForActor(
    { ...a, companyId: a.companyId! },
    input,
  );
  return { id: row.id, name: row.name, type: row.type, branchId: row.branchId };
}
