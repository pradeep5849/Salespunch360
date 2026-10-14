import {prepareTransferImagePayload,addTransferImageForActor,transferImageForActor} from "@/lib/account/money-transfer-image";
import {editLoanMetadataForActor,topUpLoanForActor,changeLoanLifecycleForActor} from "@/lib/account/loan-operations";
import {loanOverviewForActor} from "@/lib/account/loan-overview";
import {loanHistoryForActor} from "@/lib/account/loan-history";
import {
  moneyAdjustmentOptionsForActor,
  postMoneyAdjustmentForActor,
} from "@/lib/account/money-adjustment";
import { moneyReadContext } from "@/lib/account/money-context";
import { chequeFinancialActionForActor } from "@/lib/account/cheque-finance";
import {
  chequePageForActor,
  chequeListQuerySchema,
} from "@/lib/account/cheque-list";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { z } from "zod";
import { ownerHistoryForActor } from "@/lib/account/owner-history";
import { ownerCapitalSummaryForActor } from "@/lib/account/owner-capital-summary";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  createChequeForActor,
  createAndReceiveLoanForActor,
  createOwnerFinancialAccountForActor,
  updateOwnerFinancialAccountForActor,
  createMoneyAccountForActor,
  createMoneyTransferForActor,
  deactivateMoneyAccountForActor,
  listMoneyDataForActor,
  moneyDashboardForActor,
  postLoanPaymentForActor,
  postOwnerTransactionForActor,
  setupOwnerFinancialAccountForActor,
  updateMoneyAccountForActor,
} from "@/lib/account/money";
import { db } from "@/lib/db";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";
function permit(
  u: MobileAppPrincipal,
  p: Parameters<typeof canUsePermission>[2],
) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, p))
    throw new Error("MOBILE_FORBIDDEN");
  return a;
}
const write = async (u: MobileAppPrincipal) =>
  assertOperationalWrite(u.companyId);
export async function mobileMoneyContext(
  u: MobileAppPrincipal,
  query: unknown = {},
) {
  const readScope = await moneyReadContext(
    permit(u, "ACCOUNT_MONEY_VIEW"),
    query,
  );
  const a = readScope.actor,
    data = await listMoneyDataForActor(a),
    scope =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: a.branchIds ?? [] } }
        : {},
    loanIds = data.loans.map((x) => x.id),
    ownerIds = data.owners
      .map((x) => x.userId)
      .filter((id): id is string => Boolean(id));
  const [transfers, ownerTransactions, loanPayments, users] = await Promise.all(
    [
      db.moneyTransfer.findMany({
        include:{image:{select:{id:true}}},
        where: { companyId: a.companyId, ...scope },
        orderBy: { transferDate: "desc" },
        take: 200,
      }),
      db.ownerTransaction.findMany({
        where: { companyId: a.companyId, ...scope },
        orderBy: { transactionDate: "desc" },
        take: 200,
      }),
      db.loanPayment.findMany({
        where: { companyId: a.companyId, loanId: { in: loanIds } },
        orderBy: { paymentDate: "desc" },
        take: 200,
      }),
      db.user.findMany({
        where: { companyId: a.companyId, id: { in: ownerIds } },
        select: { id: true, name: true },
      }),
    ],
  );
  return {
    ...data,
    adjustmentOptions: data.capabilities.postMoneyEntries
      ? await moneyAdjustmentOptionsForActor(a)
      : null,
    branchContext: readScope.context,
    owners: data.owners.map((x) => ({
      ...x,
      name: x.name || users.find((u) => u.id === x.userId)?.name || "Owner",
    })),
    transfers,
    ownerTransactions,
    loanPayments,
  };
}
export async function mobileCreateMoneyAccount(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return createMoneyAccountForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileUpdateMoneyAccount(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  const a = permit(u, "ACCOUNT_MONEY_ENTRY");
  await updateMoneyAccountForActor(a, id, raw);
  return moneyDashboardForActor(a);
}
export async function mobileDisableMoneyAccount(
  u: MobileAppPrincipal,
  id: string,
) {
  await write(u);
  await deactivateMoneyAccountForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), id);
  return { ok: true };
}
export async function mobileMoneyTransfer(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  const actor=permit(u,"ACCOUNT_MONEY_ENTRY"),input=z.object({image:z.unknown().optional()}).passthrough().parse(raw),image=await prepareTransferImagePayload(input.image);
  const row=await createMoneyTransferForActor(actor,raw);
  if(image)try{await addTransferImageForActor(actor,row.id,image);}catch(error){if(error instanceof Error&&error.message==="TRANSFER_IMAGE_ALREADY_ATTACHED")throw error;throw new Error("TRANSFER_POSTED_IMAGE_UPLOAD_FAILED");}
  return row;
}
export async function mobileOwnerTransaction(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return postOwnerTransactionForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileLoan(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createAndReceiveLoanForActor(permit(u, "ACCOUNT_LOAN_ADMIN"), raw);
}
export async function mobileLoanPayment(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return postLoanPaymentForActor(permit(u, "ACCOUNT_LOAN_ADMIN"), raw);
}

export async function mobileOwnerSetup(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  const a = permit(u, "ACCOUNT_LOAN_ADMIN");
  const d = raw as { name?: string; userId?: string; branchId?: string };
  const row = d.name
    ? await createOwnerFinancialAccountForActor(a, raw)
    : d.userId && d.branchId
      ? await setupOwnerFinancialAccountForActor(a, d.userId, d.branchId)
      : null;
  if (!row) throw new Error("INVALID_INPUT");
  return ownerIdentityView(row);
}
function ownerIdentityView(row: {
  id: string;
  name: string;
  partyType: string;
  userId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    partyType: row.partyType,
    userId: row.userId,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isActive: row.isActive,
  };
}
export async function mobileUpdateOwnerIdentity(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  return ownerIdentityView(
    await updateOwnerFinancialAccountForActor(
      permit(u, "ACCOUNT_LOAN_ADMIN"),
      id,
      raw,
    ),
  );
}

export async function mobileOwnerCapitalSummary(u: MobileAppPrincipal) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, "ACCOUNT_MONEY_VIEW"))
    throw new Error("MOBILE_FORBIDDEN");
  return ownerCapitalSummaryForActor(a);
}

export async function mobileOwnerHistory(
  u: MobileAppPrincipal,
  id: string,
  filters: unknown,
) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, "ACCOUNT_MONEY_VIEW"))
    throw new Error("MOBILE_FORBIDDEN");
  return ownerHistoryForActor(a, id, filters);
}

export async function mobileChequePage(
  u: MobileAppPrincipal,
  raw: unknown = {},
) {
  const actor = permit(u, "ACCOUNT_MONEY_VIEW");
  const { scope, ...query } = chequeListQuerySchema
    .extend({ scope: z.literal("all").optional() })
    .parse(raw);
  const context = await resolveAccountBranchContext(actor, {
    branchId: query.branchId,
    scope,
  });
  return chequePageForActor(actor, {
    ...query,
    branchId:
      context.context.mode === "BRANCH" ? context.context.branchId : undefined,
  });
}

export async function mobileCreateCheque(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createChequeForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileChequeFinancialAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  return chequeFinancialActionForActor(
    permit(u, "ACCOUNT_MONEY_ENTRY"),
    id,
    raw,
  );
}

export async function mobileCompleteLegacyChequeSource(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  const { completeLegacyChequeSourceForActor } =
    await import("@/lib/account/cheque-finance");
  return completeLegacyChequeSourceForActor(
    permit(u, "ACCOUNT_MONEY_ENTRY"),
    id,
    raw,
  );
}

export async function mobileChequeParties(u: MobileAppPrincipal, raw: unknown) {
  const { searchChequePartiesForActor } =
    await import("@/lib/account/cheque-parties");
  return searchChequePartiesForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileChequeEntryOptions(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  const { chequeEntryOptionsForActor } =
    await import("@/lib/account/cheque-entry-options");
  return chequeEntryOptionsForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}

export async function mobileMoneyAccountHistory(
  u: MobileAppPrincipal,
  id: string,
  query: unknown = {},
) {
  const { moneyAccountHistoryForActor } =
    await import("@/lib/account/money-account-history");
  return moneyAccountHistoryForActor(
    permit(u, "ACCOUNT_MONEY_VIEW"),
    id,
    query,
  );
}

export async function mobileMoneyAdjustment(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return postMoneyAdjustmentForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}

export async function mobileLoanOverview(u:MobileAppPrincipal,query:unknown={}) { return loanOverviewForActor(permit(u,"ACCOUNT_MONEY_VIEW"),query); }
export async function mobileLoanHistory(u:MobileAppPrincipal,id:string,query:unknown={}) { return loanHistoryForActor(permit(u,"ACCOUNT_MONEY_VIEW"),id,query); }

export async function mobileEditLoanMetadata(u:MobileAppPrincipal,id:string,raw:unknown){await write(u);return editLoanMetadataForActor(permit(u,"ACCOUNT_LOAN_ADMIN"),id,raw);}

export async function mobileTopUpLoan(u:MobileAppPrincipal,id:string,raw:unknown){await write(u);return topUpLoanForActor(permit(u,"ACCOUNT_LOAN_ADMIN"),id,raw);}
export async function mobileChangeLoanLifecycle(u:MobileAppPrincipal,id:string,raw:unknown){await write(u);return changeLoanLifecycleForActor(permit(u,"ACCOUNT_LOAN_ADMIN"),id,raw);}

export async function mobileMoneyTransferImage(u:MobileAppPrincipal,id:string){return transferImageForActor(permit(u,"ACCOUNT_MONEY_VIEW"),id);}
