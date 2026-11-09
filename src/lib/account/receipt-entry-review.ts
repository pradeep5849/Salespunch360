import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { scopedPartyBalance } from "./party-balance";
import type { ProjectActor } from "./projects";
/** Non-reserving preview. Save always allocates the current number inside its financial transaction. */
export async function receiptEntryReviewForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  if (
    !canUsePermission(
      actor,
      "SALESPUNCH360_ACCOUNT",
      "ACCOUNT_SETTLEMENT_ENTRY",
    )
  )
    throw new AuthorizationError();
  const { branchId, customerId } = z
    .object({
      branchId: z.string().uuid(),
      customerId: z.string().uuid().optional(),
    })
    .strict()
    .parse(raw);
  if (
    actor.branchAccessScope === "SELECTED_BRANCHES" &&
    !actor.branchIds?.includes(branchId)
  )
    throw new AuthorizationError();
  if (
    !(await db.branch.findFirst({
      where: { id: branchId, companyId: actor.companyId, isActive: true },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
  if (
    customerId &&
    !(await db.customer.findFirst({
      where: {
        id: customerId,
        companyId: actor.companyId,
        branchId,
        isActive: true,
        isAccountCustomer: true,
      },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
  const series = await db.numberingSeries.findMany({
    where: {
      companyId: actor.companyId,
      branchId,
      seriesKey: { in: ["CUSTOMER_RECEIPT", "CUSTOMER_ADVANCE"] },
    },
    select: {
      seriesKey: true,
      prefix: true,
      suffix: true,
      padding: true,
      nextSequence: true,
      isActive: true,
    },
  });
  const preview = (key: string, prefix: string) => {
    const row = series.find((row) => row.seriesKey === key);
    return row && !row.isActive
      ? null
      : `${row?.prefix ?? prefix}${String(row?.nextSequence ?? 1).padStart(row?.padding ?? 6, "0")}${row?.suffix ?? ""}`;
  };
  return {
    balance: customerId
      ? await scopedPartyBalance(actor.companyId, customerId, true, [branchId])
      : null,
    receiptNumber: preview("CUSTOMER_RECEIPT", "CR-"),
    advanceNumber: preview("CUSTOMER_ADVANCE", "CA-"),
  };
}
