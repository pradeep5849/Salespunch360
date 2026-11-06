import type { CommercialDocumentType } from "@prisma/client";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  commercialDocumentControlsForActor,
  finalizeNonFinancialDocumentForActor,
  commercialDocumentPolicies,
  commercialEditorOptionsForActor,
  createCommercialDocumentForActor,
  documentOutstandingsBatch,
  getCommercialDocumentForActor,
  listCommercialDocumentsPageForActor,
  postCommercialDocumentForActor,
} from "@/lib/account/commercial";
import { db } from "@/lib/db";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";

const TYPES = new Set<CommercialDocumentType>([
  "PURCHASE_BILL",
  "PURCHASE_ORDER",
  "DEBIT_NOTE",
]);

function permit(
  u: MobileAppPrincipal,
  p: Parameters<typeof canUsePermission>[2],
) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, p))
    throw new Error("MOBILE_FORBIDDEN");
  return a;
}

export async function mobilePurchaseOptions(u: MobileAppPrincipal) {
  const a = permit(u, "ACCOUNT_LEDGER_VIEW"),
    o = await commercialEditorOptionsForActor(a);
  return {
    ...o,
    allowedDocumentTypes: o.allowedDocumentTypes.filter((x) => TYPES.has(x)),
  };
}

export async function mobilePurchasePage(
  u: MobileAppPrincipal,
  type?: string | null,
  q?: string | null,
  cursor?: string | null,
  branchId?: string | null,
) {
  const page = await listCommercialDocumentsPageForActor(
    permit(u, "ACCOUNT_LEDGER_VIEW"),
    {
      type: type ?? undefined,
      q: q ?? undefined,
      cursor: cursor ?? undefined,
      branchId: branchId ?? undefined,
    },
    [...TYPES],
  );
  return {
    ...page,
    rows: page.rows.map((row) => ({
      ...row,
      outstanding:
        row.status === "CANCELLED" ? "0" : row.outstanding.toString(),
      paymentStatus:
        row.status === "CANCELLED"
          ? "CANCELLED"
          : row.type === "PURCHASE_BILL" && row.status === "POSTED"
            ? row.outstanding.isZero()
              ? "PAID"
              : row.outstanding.eq(row.payableAmount ?? row.grandTotal)
                ? "UNPAID"
                : "PARTIALLY_PAID"
            : row.status,
    })),
  };
}
export async function mobilePurchaseList(
  u: MobileAppPrincipal,
  type?: string | null,
  q?: string | null,
) {
  return (await mobilePurchasePage(u, type, q)).rows;
}

export async function mobilePurchaseDetail(u: MobileAppPrincipal, id: string) {
  const x = await getCommercialDocumentForActor(
    permit(u, "ACCOUNT_LEDGER_VIEW"),
    id,
  );
  if (!TYPES.has(x.type)) throw new Error("MOBILE_FORBIDDEN");
  const controls=await commercialDocumentControlsForActor(mobileAccountActor(u),id);
  return {
    ...x,
    shareAs:controls.shareAs,
    canDuplicatePurchase:controls.canDuplicatePurchase,
    canCorrectPurchase:controls.canCorrectPurchase,
    canEditTransactionSettings:controls.canEditTransactionSettings,
    canPost:
      x.status === "DRAFT" &&
      ["PURCHASE_BILL", "DEBIT_NOTE"].includes(x.type) &&
      canUsePermission(
        mobileAccountActor(u),
        u.productEdition,
        "ACCOUNT_JOURNAL_POST",
      ),
    canConfirmOrder:
      x.status === "DRAFT" &&
      x.type === "PURCHASE_ORDER" &&
      canUsePermission(
        mobileAccountActor(u),
        u.productEdition,
        "ACCOUNT_PURCHASE_ENTRY",
      ),
  };
}

export async function mobileCreatePurchase(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  const type = (raw as { type?: CommercialDocumentType }).type;
  if (!type || !TYPES.has(type)) throw new Error("INVALID_INPUT");
  await assertOperationalWrite(u.companyId);
  return createCommercialDocumentForActor(
    permit(u, commercialDocumentPolicies[type].permission),
    raw,
  );
}

export async function mobilePostPurchase(u: MobileAppPrincipal, id: string) {
  await assertOperationalWrite(u.companyId);
  const a = permit(u, "ACCOUNT_JOURNAL_POST"),
    x = await getCommercialDocumentForActor(a, id);
  if (!TYPES.has(x.type)) throw new Error("MOBILE_FORBIDDEN");
  return postCommercialDocumentForActor(a, { documentId: id });
}

export async function mobileVendorPayment(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  if (
    !["VENDOR_PAYMENT", "VENDOR_ADVANCE"].includes(
      String((raw as { type?: string }).type),
    )
  )
    throw new Error("INVALID_INPUT");
  const { createAllocatedPaymentForActor } =
    await import("@/lib/account/allocated-payment");
  return createAllocatedPaymentForActor(
    permit(u, "ACCOUNT_SETTLEMENT_ENTRY"),
    raw,
  );
}

export async function mobileVendorPaymentContext(u: MobileAppPrincipal) {
  const a = permit(u, "ACCOUNT_SETTLEMENT_ENTRY"),
    scope =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: a.branchIds ?? [] } }
        : {},
    moneyAccountScope =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { OR: [{ branchId: null }, { branchId: { in: a.branchIds ?? [] } }] }
        : {},
    [vendors, branches, moneyAccounts, documents, payments] = await Promise.all(
      [
        db.vendor.findMany({
          where: { companyId: a.companyId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.branch.findMany({
          where: {
            companyId: a.companyId,
            isActive: true,
            ...(a.branchAccessScope === "SELECTED_BRANCHES"
              ? { id: { in: a.branchIds ?? [] } }
              : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.moneyAccount.findMany({
          where: {
            companyId: a.companyId,
            isActive: true,
            ...moneyAccountScope,
          },
          select: { id: true, name: true, branchId: true },
          orderBy: { name: "asc" },
        }),
        db.commercialDocument.findMany({
          where: {
            companyId: a.companyId,
            type: "PURCHASE_BILL",
            status: "POSTED",
            ...scope,
          },
          select: {
            id: true,
            branchId: true,
            vendorId: true,
            documentNumber: true,
            grandTotal: true,
            payableAmount: true,
          },
          orderBy: { issueDate: "desc" },
        }),
        db.accountSettlement.findMany({
          where: {
            companyId: a.companyId,
            type: { in: ["VENDOR_PAYMENT", "VENDOR_ADVANCE"] },
            ...scope,
          },
          select: {
            id: true,
            branchId: true,
            vendorId: true,
            type: true,
            settlementNumber: true,
            transactionDate: true,
            amount: true,
            paymentMode: true,
            reference: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 100,
        }),
      ],
    ),
    outstanding = await documentOutstandingsBatch(a.companyId, documents);
  const { enabledModulesForCompany } = await import("@/lib/account/modules");
  const { listOpeningOutstandings } =
    await import("@/lib/account/opening-balances");
  const enabled = await enabledModulesForCompany(a.companyId);
  const openings = await listOpeningOutstandings({
    companyId: a.companyId,
    partyType: "VENDOR",
    branchIds:
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? (a.branchIds ?? [])
        : undefined,
  });
  return {
    allowedTypes: [
      ...(enabled.includes("VENDOR_PAYMENTS") ? ["VENDOR_PAYMENT"] : []),
      ...(enabled.includes("VENDOR_ADVANCES") ? ["VENDOR_ADVANCE"] : []),
    ],
    openings: openings.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      partyId: row.partyId,
      outstanding: row.outstanding.toString(),
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
    })),
    vendors,
    branches,
    moneyAccounts,
    documents: documents
      .map((x) => ({
        ...x,
        outstanding: outstanding.get(x.id)?.toString() ?? "0",
      }))
      .filter((x) => x.outstanding !== "0"),
    payments,
  };
}

export async function mobileConfirmPurchaseOrder(
  u: MobileAppPrincipal,
  id: string,
) {
  await assertOperationalWrite(u.companyId);
  const actor = permit(u, "ACCOUNT_PURCHASE_ENTRY");
  return finalizeNonFinancialDocumentForActor(actor, { documentId: id });
}
