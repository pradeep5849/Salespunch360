import {sumPersistedMoney} from "./money-sum";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { LEDGER_EFFECTIVE_JOURNAL_STATUSES } from "@/lib/accounting/ledger-policy";
import { requireAccountModules } from "./modules";
import type { ProjectActor } from "./projects";
const D = Prisma.Decimal,
  zero = new D(0),
  amount = z
    .string()
    .regex(/^\d{1,16}(\.\d{1,2})?$/)
    .refine((v) => new D(v).gt(0), "Positive amount required");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(new Date(v).getTime()) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Valid date required",
  )
  .transform((v) => new Date(v));
const exactSum=(values:ReadonlyArray<Prisma.Decimal>)=>new D(sumPersistedMoney(values));
export const fundingReturnsSchema = z
  .array(z.object({ fundingId: z.string().uuid(), amount }).strict())
  .max(100)
  .superRefine((rows, ctx) => {
    if (new Set(rows.map((r) => r.fundingId)).size !== rows.length)
      ctx.addIssue({
        code: "custom",
        message: "Choose each funding allocation once",
      });
  })
  .transform((rows) =>
    rows
      .map((r) => ({ ...r, amount: new D(r.amount).toFixed(2) }))
      .sort((a, b) => a.fundingId.localeCompare(b.fundingId)),
  );
export type FundingReturnInput = z.infer<typeof fundingReturnsSchema>;
export type FundingRow = {
  id: string;
  companyId: string;
  branchId: string;
  assetId: string;
  assetName: string;
  purchaseValue: Prisma.Decimal;
  ownerFinancialAccountId: string;
  ownerName: string;
  contributionTransactionId: string;
  amount: Prisma.Decimal;
  allocationDate: Date;
  returned: Prisma.Decimal;
};
function permit(a: ProjectActor, write = false) {
  if (
    !canUsePermission(
      a,
      "SALESPUNCH360_ACCOUNT",
      write ? "ACCOUNT_MONEY_ENTRY" : "ACCOUNT_MONEY_VIEW",
    )
  )
    throw new AuthorizationError();
}
function branch(a: ProjectActor, id: string) {
  if (a.branchAccessScope === "SELECTED_BRANCHES" && !a.branchIds?.includes(id))
    throw new AuthorizationError();
}
export function remainingFunding(row: Pick<FundingRow, "amount" | "returned">) {
  const remaining = new D(row.amount).sub(row.returned);
  if (remaining.lt(0)) throw new Error("ASSET_FUNDING_INVALID_STATE");
  return remaining;
}
/** Effective financing uses the original contribution and repayment journals. Asset cost is never changed. */
export async function fundingRowsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  branches?: readonly string[],
): Promise<FundingRow[]> {
  if (branches?.length === 0) return [];
  const access =
    branches === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`f."branchId" IN (${Prisma.join(branches.map((id) => Prisma.sql`${id}::uuid`))})`;
  return tx.$queryRaw<
    FundingRow[]
  >`SELECT f.*,a."name" AS "assetName",a."purchaseValue",o."name" AS "ownerName",COALESCE(r."returned",0)::numeric AS "returned"
 FROM "asset_owner_fundings" f JOIN "assets" a ON a."companyId"=f."companyId" AND a."id"=f."assetId"
 JOIN "owner_financial_accounts" o ON o."companyId"=f."companyId" AND o."id"=f."ownerFinancialAccountId"
 JOIN "owner_transactions" c ON c."companyId"=f."companyId" AND c."id"=f."contributionTransactionId" AND c."type"='INVESTMENT'
 JOIN "journal_entries" cj ON cj."companyId"=c."companyId" AND cj."id"=c."journalEntryId" AND cj."status"='POSTED'
 LEFT JOIN "asset_owner_funding_cancellations" x ON x."companyId"=f."companyId" AND x."fundingId"=f."id"
 LEFT JOIN LATERAL(SELECT SUM(fr."amount") AS "returned" FROM "owner_asset_funding_returns" fr
 JOIN "owner_transactions" ot ON ot."companyId"=fr."companyId" AND ot."id"=fr."ownerTransactionId" AND ot."type"='CAPITAL_WITHDRAWAL'
 JOIN "journal_entries" j ON j."companyId"=ot."companyId" AND j."id"=ot."journalEntryId" AND j."status"='POSTED'
 WHERE fr."companyId"=f."companyId" AND fr."fundingId"=f."id") r ON true
 WHERE f."companyId"=${companyId}::uuid AND ${access} AND x."id" IS NULL AND a."status"<>'DISPOSED'`;
}
async function capitalInTx(
  tx: Prisma.TransactionClient,
  a: Pick<ProjectActor, "companyId">,
  ledgerId: string,
) {
  const value = await tx.journalLine.aggregate({
    where: {
      companyId: a.companyId,
      ledgerAccountId: ledgerId,
      journalEntry: {
        companyId: a.companyId,
        status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
      },
    },
    _sum: { debit: true, credit: true },
  });
  return exactSum([new D(value._sum.credit??0),new D(value._sum.debit??0).negated()]);
}
export async function fundingReturnReplayMatches(
  tx: Prisma.TransactionClient,
  companyId: string,
  transactionId: string,
  rows: FundingReturnInput,
) {
  const saved = await tx.ownerAssetFundingReturn.findMany({
    where: { companyId, ownerTransactionId: transactionId },
    orderBy: { fundingId: "asc" },
    select: { fundingId: true, amount: true },
  });
  return (
    JSON.stringify(
      saved.map((r) => ({ ...r, amount: r.amount.toFixed(2) })),
    ) === JSON.stringify(rows)
  );
}
export async function validateFundingReturnsInTx(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
  input: {
    ownerFinancialAccountId: string;
    branchId: string;
    transactionDate: Date;
    amount: string;
    fundingReturns: FundingReturnInput;
  },
  capitalLedgerId: string,
) {
  const all = await fundingRowsInTx(tx, a.companyId),
    owned = all.filter(
      (r) => r.ownerFinancialAccountId === input.ownerFinancialAccountId,
    ),
    capital = await capitalInTx(tx, a, capitalLedgerId),
    reserved = exactSum(owned.map(row=>remainingFunding(row))),
    total = exactSum(input.fundingReturns.map(row=>new D(row.amount)));
  if (total.gt(input.amount))
    throw new Error("ASSET_FUNDING_RETURN_EXCEEDS_PAYMENT");
  if (new D(input.amount).gt(capital))
    throw new Error("INSUFFICIENT_OWNER_CAPITAL");
  for (const allocation of input.fundingReturns) {
    const row = owned.find((r) => r.id === allocation.fundingId);
    if (
      !row ||
      row.branchId !== input.branchId ||
      row.allocationDate > input.transactionDate
    )
      throw new Error("INVALID_ASSET_FUNDING_RETURN");
    branch(a, row.branchId);
    if (new D(allocation.amount).gt(remainingFunding(row)))
      throw new Error("ASSET_FUNDING_RETURN_EXCEEDS_BALANCE");
  }
  if (new D(input.amount).sub(total).gt(D.max(zero, exactSum([capital,reserved.negated()]))))
    throw new Error("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
}
/** External journals cannot remove capital reserved against retained assets. */
export async function assertOwnerAssetFundingCapitalInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  lines: ReadonlyArray<{
    ledgerAccountId: string;
    debit: Prisma.Decimal.Value;
    credit: Prisma.Decimal.Value;
  }>,
  restoreTransactionId?: string,
) {
  const rows = await fundingRowsInTx(tx, companyId);
  if (!rows.length) return;
  const restore = restoreTransactionId
    ? await tx.ownerAssetFundingReturn.findMany({
        where: { companyId, ownerTransactionId: restoreTransactionId },
        select: { fundingId: true, amount: true },
      })
    : [];
  for (const assetId of new Set(rows.map((row) => row.assetId))) {
    const affected = rows.filter((row) => row.assetId === assetId),
      after = affected.reduce(
        (sum, row) =>
          sum
            .add(remainingFunding(row))
            .add(
              restore
                .filter((value) => value.fundingId === row.id)
                .reduce((n, r) => n.add(r.amount), zero),
            ),
        zero,
      );
    if (after.gt(affected[0].purchaseValue))
      throw new Error("ASSET_FUNDING_REPAYMENT_REALLOCATED");
  }
  const owners = await tx.ownerFinancialAccount.findMany({
    where: {
      companyId,
      id: { in: [...new Set(rows.map((row) => row.ownerFinancialAccountId))] },
    },
    select: { id: true, capitalLedgerId: true },
  });
  for (const owner of owners) {
    const changed = lines.filter(
      (line) => line.ledgerAccountId === owner.capitalLedgerId,
    );
    if (!changed.length) continue;
    const owned = rows.filter(
        (row) => row.ownerFinancialAccountId === owner.id,
      ),
      reserved = exactSum(owned.flatMap(row=>[remainingFunding(row),...restore.filter(value=>value.fundingId===row.id).map(value=>value.amount)])),
      capital = await capitalInTx(tx, { companyId }, owner.capitalLedgerId),
      after = exactSum([capital,...changed.flatMap(line=>[new D(line.credit),new D(line.debit).negated()])]);
    if (reserved.gt(0) && after.lt(reserved))
      throw new Error("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
  }
}
async function recordConfirmationInTx(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
  input: {
    assetId: string;
    branchId: string;
    expectedPurchaseValue: string;
    confirmed: boolean;
    reason: string;
    requestKey: string;
  },
) {
  const old = await tx.assetFundingConfirmation.findUnique({
    where: {
      companyId_requestKey: {
        companyId: a.companyId,
        requestKey: input.requestKey,
      },
    },
  });
  if (old) {
    if (
      old.assetId !== input.assetId ||
      old.branchId !== input.branchId ||
      !old.costBasis.eq(input.expectedPurchaseValue) ||
      old.confirmed !== input.confirmed ||
      old.reason !== input.reason
    )
      throw new Error("IDEMPOTENCY_CONFLICT");
    return old;
  }
  const asset = await tx.asset.findFirst({
    where: {
      companyId: a.companyId,
      id: input.assetId,
      branchId: input.branchId,
      status: { not: "DISPOSED" },
    },
    select: { purchaseValue: true },
  });
  if (!asset || !asset.purchaseValue.eq(input.expectedPurchaseValue))
    throw new Error("ASSET_FUNDING_CHANGED");
  const allocated = (await fundingRowsInTx(tx, a.companyId))
    .filter((row) => row.assetId === input.assetId)
    .reduce((sum, row) => sum.add(remainingFunding(row)), zero);
  if (allocated.gt(asset.purchaseValue))
    throw new Error("ASSET_FUNDING_INVALID_STATE");
  const previous = await tx.assetFundingConfirmation.findFirst({
    where: { companyId: a.companyId, assetId: input.assetId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  const row = await tx.assetFundingConfirmation.create({
    data: {
      companyId: a.companyId,
      assetId: input.assetId,
      branchId: input.branchId,
      costBasis: asset.purchaseValue,
      confirmed: input.confirmed,
      reason: input.reason,
      requestKey: input.requestKey,
      revision: (previous?.revision ?? 0) + 1,
      createdById: a.id,
    },
  });
  await tx.accountOperationalAudit.create({
    data: {
      companyId: a.companyId,
      actorUserId: a.id,
      eventType: input.confirmed
        ? "ASSET_FUNDING_REMAINDER_CONFIRMED"
        : "ASSET_FUNDING_CLASSIFICATION_CLEARED",
      entityType: "ASSET",
      entityId: input.assetId,
      metadata: {
        revision: row.revision,
        costBasis: row.costBasis.toFixed(2),
        reason: row.reason,
      },
    },
  });
  return row;
}
export async function confirmAssetFundingForActor(
  a: ProjectActor,
  raw: unknown,
) {
  permit(a, true);
  await requireAccountModules(a, "ASSETS");
  const input = z
    .object({
      assetId: z.string().uuid(),
      branchId: z.string().uuid(),
      expectedPurchaseValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
      confirmed: z.boolean(),
      reason: z.string().trim().min(3).max(1000),
      requestKey: z.string().uuid(),
    })
    .strict()
    .parse(raw);
  branch(a, input.branchId);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
      return recordConfirmationInTx(tx, a, input);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
const createInput = z
  .object({
    branchId: z.string().uuid(),
    assetId: z.string().uuid(),
    ownerFinancialAccountId: z.string().uuid(),
    contributionTransactionId: z.string().uuid(),
    amount,
    allocationDate: date,
    requestKey: z.string().uuid(),
    expectedPurchaseValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
    confirmCompanyRemainder: z.literal(true),
  })
  .strict();
export async function allocateOwnerAssetFundingForActor(
  a: ProjectActor,
  raw: unknown,
) {
  permit(a, true);
  await requireAccountModules(a, "ASSETS");
  const d = createInput.parse(raw);
  branch(a, d.branchId);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
      const existing = await tx.assetOwnerFunding.findUnique({
        where: {
          companyId_requestKey: {
            companyId: a.companyId,
            requestKey: d.requestKey,
          },
        },
      });
      if (existing) {
        branch(a, existing.branchId);
        const confirmation = await tx.assetFundingConfirmation.findUnique({
          where: {
            companyId_requestKey: {
              companyId: a.companyId,
              requestKey: d.requestKey,
            },
          },
        });
        if (
          !confirmation?.costBasis.eq(d.expectedPurchaseValue) ||
          existing.branchId !== d.branchId ||
          existing.assetId !== d.assetId ||
          existing.ownerFinancialAccountId !== d.ownerFinancialAccountId ||
          existing.contributionTransactionId !== d.contributionTransactionId ||
          !existing.amount.eq(d.amount) ||
          existing.allocationDate.getTime() !== d.allocationDate.getTime()
        )
          throw new Error("IDEMPOTENCY_CONFLICT");
        return existing;
      }
      const [asset, owner, contribution] = await Promise.all([
        tx.asset.findFirst({
          where: {
            id: d.assetId,
            companyId: a.companyId,
            branchId: d.branchId,
            status: { not: "DISPOSED" },
          },
        }),
        tx.ownerFinancialAccount.findFirst({
          where: {
            id: d.ownerFinancialAccountId,
            companyId: a.companyId,
            isActive: true,
          },
        }),
        tx.ownerTransaction.findFirst({
          where: {
            id: d.contributionTransactionId,
            companyId: a.companyId,
            branchId: d.branchId,
            ownerFinancialAccountId: d.ownerFinancialAccountId,
            type: "INVESTMENT",
          },
        }),
      ]);
      if (
        !asset ||
        !owner ||
        !contribution ||
        asset.purchaseDate > d.allocationDate ||
        contribution.transactionDate > d.allocationDate ||
        !(await tx.journalEntry.findFirst({
          where: {
            id: contribution.journalEntryId,
            companyId: a.companyId,
            status: "POSTED",
          },
          select: { id: true },
        }))
      )
        throw new Error("INVALID_ASSET_FUNDING_SOURCE");
      const rows = await fundingRowsInTx(tx, a.companyId),
        sourceUsed = rows
          .filter((r) => r.contributionTransactionId === contribution.id)
          .reduce((sum, r) => sum.add(r.amount), zero),
        assetUsed = rows
          .filter((r) => r.assetId === asset.id)
          .reduce((sum, r) => sum.add(remainingFunding(r)), zero),
        ownerUsed = exactSum(rows.filter(r=>r.ownerFinancialAccountId===owner.id).map(r=>remainingFunding(r))),
        capital = await capitalInTx(tx, a, owner.capitalLedgerId);
      if (
        sourceUsed.add(d.amount).gt(contribution.amount) ||
        assetUsed.add(d.amount).gt(asset.purchaseValue) ||
        exactSum([ownerUsed,new D(d.amount)]).gt(capital)
      )
        throw new Error("ASSET_FUNDING_EXCEEDS_AVAILABLE");
      const { expectedPurchaseValue, confirmCompanyRemainder, ...funding } = d;
      void confirmCompanyRemainder;
      const row = await tx.assetOwnerFunding.create({
        data: { companyId: a.companyId, ...funding, createdById: a.id },
      });
      await recordConfirmationInTx(tx, a, {
        assetId: asset.id,
        branchId: d.branchId,
        expectedPurchaseValue,
        confirmed: true,
        reason: "Owner funding allocation",
        requestKey: d.requestKey,
      });
      await tx.accountOperationalAudit.create({
        data: {
          companyId: a.companyId,
          actorUserId: a.id,
          eventType: "OWNER_ASSET_FUNDING_ALLOCATED",
          entityType: "ASSET_OWNER_FUNDING",
          entityId: row.id,
          metadata: {
            assetId: asset.id,
            contributionTransactionId: contribution.id,
            amount: row.amount.toFixed(2),
          },
        },
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
export async function cancelOwnerAssetFundingForActor(
  a: ProjectActor,
  raw: unknown,
) {
  permit(a, true);
  await requireAccountModules(a, "ASSETS");
  const d = z
    .object({
      fundingId: z.string().uuid(),
      reason: z.string().trim().min(3).max(1000),
      requestKey: z.string().uuid(),
      expectedPurchaseValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
      confirmCompanyRemainder: z.literal(true),
    })
    .strict()
    .parse(raw);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
      const funding = await tx.assetOwnerFunding.findFirst({
        where: { id: d.fundingId, companyId: a.companyId },
      });
      if (!funding) throw new Error("INVALID_ASSET_FUNDING_SOURCE");
      branch(a, funding.branchId);
      const old = await tx.assetOwnerFundingCancellation.findUnique({
        where: {
          companyId_requestKey: {
            companyId: a.companyId,
            requestKey: d.requestKey,
          },
        },
      });
      if (old) {
        if (
          old.fundingId !== d.fundingId ||
          old.reason !== d.reason ||
          !(
            await tx.assetFundingConfirmation.findUnique({
              where: {
                companyId_requestKey: {
                  companyId: a.companyId,
                  requestKey: d.requestKey,
                },
              },
            })
          )?.costBasis.eq(d.expectedPurchaseValue)
        )
          throw new Error("IDEMPOTENCY_CONFLICT");
        return old;
      }
      if (
        await tx.assetOwnerFundingCancellation.findUnique({
          where: { fundingId: d.fundingId },
        })
      )
        throw new Error("ASSET_FUNDING_ALREADY_CANCELLED");
      const paid = await tx.$queryRaw<
        Array<{ amount: Prisma.Decimal }>
      >`SELECT COALESCE(SUM(r."amount"),0)::numeric AS amount FROM "owner_asset_funding_returns" r JOIN "owner_transactions" o ON o."companyId"=r."companyId" AND o."id"=r."ownerTransactionId" JOIN "journal_entries" j ON j."companyId"=o."companyId" AND j."id"=o."journalEntryId" AND j."status"='POSTED' WHERE r."companyId"=${a.companyId}::uuid AND r."fundingId"=${d.fundingId}::uuid`;
      if (new D(paid[0]?.amount ?? 0).gt(0))
        throw new Error("ASSET_FUNDING_HAS_REPAYMENTS");
      const {
        expectedPurchaseValue,
        confirmCompanyRemainder,
        ...cancellation
      } = d;
      void confirmCompanyRemainder;
      const row = await tx.assetOwnerFundingCancellation.create({
        data: { companyId: a.companyId, ...cancellation, createdById: a.id },
      });
      await recordConfirmationInTx(tx, a, {
        assetId: funding.assetId,
        branchId: funding.branchId,
        expectedPurchaseValue,
        confirmed: true,
        reason: d.reason,
        requestKey: d.requestKey,
      });
      await tx.accountOperationalAudit.create({
        data: {
          companyId: a.companyId,
          actorUserId: a.id,
          eventType: "OWNER_ASSET_FUNDING_CANCELLED",
          entityType: "ASSET_OWNER_FUNDING",
          entityId: funding.id,
          metadata: { reason: d.reason },
        },
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
async function fundingSummaryInTx(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
) {
  const scope =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: a.branchIds ?? [] } }
        : {},
    [assets, rows] = await Promise.all([
      tx.asset.findMany({
        where: {
          companyId: a.companyId,
          ...scope,
          status: { not: "DISPOSED" },
        },
        select: { id: true, branchId: true, name: true, purchaseValue: true },
      }),
      fundingRowsInTx(
        tx,
        a.companyId,
        a.branchAccessScope === "SELECTED_BRANCHES"
          ? (a.branchIds ?? [])
          : undefined,
      ),
    ]);
  const confirmations = await tx.assetFundingConfirmation.findMany({
    where: {
      companyId: a.companyId,
      assetId: { in: assets.map((asset) => asset.id) },
    },
    orderBy: { revision: "desc" },
  });
  return assets.map((asset) => {
    const fundings = rows.filter((r) => r.assetId === asset.id),
      ownerFunded = fundings.reduce(
        (sum, r) => sum.add(remainingFunding(r)),
        zero,
      ),
      companyFunded = new D(asset.purchaseValue).sub(ownerFunded);
    if (companyFunded.lt(0)) throw new Error("ASSET_FUNDING_INVALID_STATE");
    const confirmation = confirmations.find((row) => row.assetId === asset.id),
      confirmed =
        confirmation?.confirmed &&
        confirmation.costBasis.eq(asset.purchaseValue),
      fundingStatus =
        confirmation?.confirmed &&
        !confirmation.costBasis.eq(asset.purchaseValue)
          ? "REVIEW_REQUIRED"
          : confirmed
            ? "CONFIRMED"
            : "UNALLOCATED";
    return {
      ...asset,
      purchaseValue: asset.purchaseValue.toFixed(2),
      ownerFunded: ownerFunded.toFixed(2),
      companyFunded: confirmed ? companyFunded.toFixed(2) : null,
      unallocated: confirmed ? "0.00" : companyFunded.toFixed(2),
      fundingStatus,
      fundings: fundings.map((r) => ({
        id: r.id,
        ownerFinancialAccountId: r.ownerFinancialAccountId,
        ownerName: r.ownerName,
        contributionTransactionId: r.contributionTransactionId,
        originalAmount: r.amount.toFixed(2),
        returnedAmount: r.returned.toFixed(2),
        remainingAmount: remainingFunding(r).toFixed(2),
      })),
    };
  });
}

export async function ownerAssetFundingSummaryForActor(a: ProjectActor) {
  permit(a);
  await requireAccountModules(a, "ASSETS");
  return db.$transaction((tx) => fundingSummaryInTx(tx, a), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}
export async function ownerAssetFundingOptionsForActor(
  a: ProjectActor,
  sourceSearch = "",
) {
  permit(a);
  await requireAccountModules(a, "ASSETS");
  const search = sourceSearch.trim().slice(0, 100);
  return db.$transaction(
    async (tx) => {
      const branches =
          a.branchAccessScope === "SELECTED_BRANCHES"
            ? (a.branchIds ?? [])
            : undefined,
        access =
          branches === undefined
            ? Prisma.sql`TRUE`
            : branches.length
              ? Prisma.sql`c."branchId" IN (${Prisma.join(branches.map((id) => Prisma.sql`${id}::uuid`))})`
              : Prisma.sql`FALSE`,
        scope =
          branches === undefined ? {} : { branchId: { in: [...branches] } };
      const summary = await fundingSummaryInTx(tx, a),
        sources = await tx.$queryRaw<
          Array<{
            id: string;
            branchId: string;
            ownerFinancialAccountId: string;
            ownerName: string;
            amount: Prisma.Decimal;
            transactionDate: Date;
            number: string;
            reference: string | null;
          }>
        >`SELECT c."id",c."branchId",c."ownerFinancialAccountId",o."name" AS "ownerName",c."amount",c."transactionDate",j."journalNumber" AS number,c."reference" FROM "owner_transactions" c JOIN "owner_financial_accounts" o ON o."companyId"=c."companyId" AND o."id"=c."ownerFinancialAccountId" AND o."isActive"=true JOIN "journal_entries" j ON j."companyId"=c."companyId" AND j."id"=c."journalEntryId" AND j."status"='POSTED' WHERE c."companyId"=${a.companyId}::uuid AND c."type"='INVESTMENT' AND ${access} AND (${!search} OR o."name" ILIKE ${"%" + search + "%"} OR COALESCE(c."reference",'') ILIKE ${"%" + search + "%"} OR j."journalNumber" ILIKE ${"%" + search + "%"}) ORDER BY c."transactionDate" DESC,c."createdAt" DESC,c."id" DESC LIMIT 500`;
      const history = await tx.assetOwnerFunding.findMany({
        where: { companyId: a.companyId, ...scope },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        select: {
          id: true,
          asset: { select: { name: true, status: true } },
          owner: { select: { name: true } },
          amount: true,
          allocationDate: true,
          cancellation: { select: { reason: true, createdAt: true } },
        },
      });
      return {
        summary,
        sources: sources.map((row) => ({
          ...row,
          amount: row.amount.toFixed(2),
          transactionDate: row.transactionDate.toISOString(),
        })),
        history: history.map((row) => ({
          id: row.id,
          assetName: row.asset.name,
          assetStatus: row.asset.status,
          ownerName: row.owner.name,
          amount: row.amount.toFixed(2),
          allocationDate: row.allocationDate.toISOString(),
          cancellation: row.cancellation
            ? {
                reason: row.cancellation.reason,
                date: row.cancellation.createdAt.toISOString(),
              }
            : null,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export type OwnerAssetFundingOptions = Awaited<
  ReturnType<typeof ownerAssetFundingOptionsForActor>
>;

/** Recorded capital obligations stay available for repayment when new asset creation is disabled. */
export async function ownerFundingRepaymentOptionsForActor(a: ProjectActor) {
  permit(a);
  return db.$transaction(
    async (tx) =>
      (
        await fundingRowsInTx(
          tx,
          a.companyId,
          a.branchAccessScope === "SELECTED_BRANCHES"
            ? (a.branchIds ?? [])
            : undefined,
        )
      )
        .filter((row) => remainingFunding(row).gt(0))
        .map((row) => ({
          id: row.id,
          branchId: row.branchId,
          assetId: row.assetId,
          assetName: row.assetName,
          ownerFinancialAccountId: row.ownerFinancialAccountId,
          remainingAmount: remainingFunding(row).toFixed(2),
        })),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
