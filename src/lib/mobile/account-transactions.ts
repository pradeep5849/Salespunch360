import { replacePostedSaleForActor, reversePostedSaleForActor } from "@/lib/account/sale-amendments";
import {invoiceShareUrl} from "@/lib/account/invoice-share";
import {resolveTransactionMessaging} from "@/lib/account/transaction-messaging";
import {formatMoney,formatCalendarDate,resolveDisplayPreferences} from "@/lib/account/display-preferences";
import { listOpenProjectOptionsForActor } from "@/lib/account/projects";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { applyAdvanceForActor } from "@/lib/account/commercial";
import type { CommercialDocumentType } from "@prisma/client";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  commercialDocumentPolicies,
  commercialEditorOptionsForActor,
  createCommercialDocumentForActor,
  createSettlementForActor,
  saleReceiptBalanceForActor,
  documentOutstandingsBatch,
  getCommercialDocumentForActor,
  listCommercialDocumentsForActor,
  postCommercialDocumentForActor,
} from "@/lib/account/commercial";
import { ensureOpenFinancialYearForDate } from "@/lib/account/financial-year";
import { db } from "@/lib/db";
import type { MobileAppPrincipal } from "./auth";

const SALES_TYPES = new Set<CommercialDocumentType>([
  "SALES_INVOICE",
  "PROFORMA_INVOICE",
  "SALES_ORDER",
  "DELIVERY_CHALLAN",
  "CREDIT_NOTE",
]);
export function mobileAccountActor(user: MobileAppPrincipal) {
  if (!user.authorizedWorkspaces.includes("ACCOUNT") || !user.accountRole)
    throw new Error("MOBILE_FORBIDDEN");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId,
    role: user.role,
    isActive: true,
    salesRole: user.salesRole,
    accountRole: user.accountRole,
    salesAccessActive: user.authorizedWorkspaces.includes("SALES"),
    accountAccessActive: true,
    managerType: user.managerType,
    branchAccessScope: user.branchAccessScope,
    branchIds: user.branchIds,
  };
}
export function permit(
  user: MobileAppPrincipal,
  permission: Parameters<typeof canUsePermission>[2],
) {
  const actor = mobileAccountActor(user);
  if (!canUsePermission(actor, user.productEdition, permission))
    throw new Error("MOBILE_FORBIDDEN");
  return actor;
}
export async function mobileSalesOptions(user: MobileAppPrincipal) {
  const actor = permit(user, "ACCOUNT_LEDGER_VIEW"),
    options = await commercialEditorOptionsForActor(actor);
  return {
    ...options,
    allowedDocumentTypes: options.allowedDocumentTypes.filter((type) =>
      SALES_TYPES.has(type),
    ),
  };
}
export async function mobileSalesList(
  user: MobileAppPrincipal,
  type?: string | null,
  q?: string | null,
) {
  const actor = permit(user, "ACCOUNT_LEDGER_VIEW"),
    rows = await listCommercialDocumentsForActor(actor),
    visible = rows
      .filter(
        (row) =>
          SALES_TYPES.has(row.type) &&
          !(row.type === "SALES_INVOICE" && row.status === "DRAFT") &&
          (!type || row.type === type) &&
          (!q ||
            row.documentNumber.toLowerCase().includes(q.toLowerCase()) ||
            row.partyName.toLowerCase().includes(q.toLowerCase())),
      )
      .slice(0, 200),
    sales = visible.filter(
      (row) => row.type === "SALES_INVOICE" && row.status === "POSTED",
    ),
    outstanding = await documentOutstandingsBatch(actor.companyId, sales);
  return visible.map((row) => {
    const balance = outstanding.get(row.id),
      base = row.payableAmount ?? row.grandTotal,
      paymentStatus =
        row.type === "SALES_INVOICE" && balance
          ? balance.isZero()
            ? "PAID"
            : balance.eq(base)
              ? "UNPAID"
              : "PARTIALLY_PAID"
          : undefined;
    return {
      ...row,
      outstanding:
        balance?.toString() ??
        (row.type === "SALES_INVOICE" ? row.grandTotal.toString() : undefined),
      paymentStatus,
    };
  });
}
export async function mobileSalesDetail(user: MobileAppPrincipal, id: string) {
  const row = await getCommercialDocumentForActor(
    permit(user, "ACCOUNT_LEDGER_VIEW"),
    id,
  );
  if (!SALES_TYPES.has(row.type)) throw new Error("MOBILE_FORBIDDEN");
  if(row.type!=="SALES_INVOICE")return row;
  const [settings,customer,company]=await Promise.all([db.accountSettings.findUnique({where:{companyId:row.companyId}}),row.customerId?db.customer.findFirst({where:{companyId:row.companyId,id:row.customerId},select:{phone:true}}):null,db.company.findUnique({where:{id:row.companyId},select:{primaryPhone:true}})]);
  const preferences=resolveTransactionMessaging(settings?.transactionDefaults),display=resolveDisplayPreferences(settings);
  const message=`Hi ${row.partyName}, invoice ${row.documentNumber} dated ${formatCalendarDate(row.issueDate,display)} totals ${formatMoney(row.payableAmount??row.grandTotal,display)}.${preferences.includeInvoiceLink&&row.status==="POSTED"?`\n${invoiceShareUrl(row)}`:""}`;
  return {...row,shareAs:((settings?.transactionDefaults as Record<string,unknown>|null)?.transactionPreferences as Record<string,unknown>|undefined)?.shareAs==="PDF"?"PDF":"ASK",preparedMessages:[...(preferences.sendToParty?[{label:"Message to party",message,phone:customer?.phone??null}]:[]),...(preferences.copyToSelf?[{label:"Copy to Self",message,phone:company?.primaryPhone??null}]:[])]};
}
export async function mobileCreateSales(
  user: MobileAppPrincipal,
  raw: unknown,
) {
  const source =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null,
    type = source?.type as CommercialDocumentType | undefined;
  if (!type || !SALES_TYPES.has(type) || !source)
    throw new Error("INVALID_INPUT");
  const policy = commercialDocumentPolicies[type];
  permit(user, policy.permission);
  await assertOperationalWrite(user.companyId);
  if (type !== "SALES_INVOICE")
    return createCommercialDocumentForActor(
      permit(user, policy.permission),
      raw,
    );
  const requestedReceived = Number(source.receivedAmount ?? 0),
    paymentType = String(source.paymentType ?? "CASH"),
    documentPayload = { ...source };
  delete documentPayload.receivedAmount;
  delete documentPayload.receivedInFull;
  delete documentPayload.paymentType;
  const actor = permit(user, "ACCOUNT_JOURNAL_POST"),
    row = await createCommercialDocumentForActor(actor, documentPayload);
  try {
    await ensureOpenFinancialYearForDate(
      actor.companyId,
      new Date(String(source.issueDate)),
    );
    await postCommercialDocumentForActor(actor, { documentId: row.id });
  } catch (error) {
    if (!documentPayload.idempotencyKey)
      await db.commercialDocument
        .deleteMany({ where: { id: row.id, status: "DRAFT" } })
        .catch(() => undefined);
    throw error;
  }
  const receivedAmount=source.receivedInFull===true?Number(await saleReceiptBalanceForActor(permit(user,"ACCOUNT_SETTLEMENT_ENTRY"),row.id,`mobile-sale-receipt:${row.id}`)):requestedReceived;
  if (Number.isFinite(receivedAmount) && receivedAmount > 0) {
    const receiptActor = permit(user, "ACCOUNT_SETTLEMENT_ENTRY");
    await createSettlementForActor(receiptActor, {
      idempotencyKey: `mobile-sale-receipt:${row.id}`,
      type: "CUSTOMER_RECEIPT",
      branchId: String(source.branchId),
      partyId: String(source.partyId),
      paymentMode: paymentType === "CASH" ? "CASH" : "BANK",
      amount: receivedAmount.toFixed(2),
      transactionDate: String(source.issueDate),
      allocations: [{ documentId: row.id, amount: receivedAmount.toFixed(2) }],
    });
  }
  return getCommercialDocumentForActor(actor, row.id);
}
export async function mobilePostSales(user: MobileAppPrincipal, id: string) {
  const actor = permit(user, "ACCOUNT_JOURNAL_POST");
  await assertOperationalWrite(user.companyId);
  const row = await getCommercialDocumentForActor(actor, id);
  if (!SALES_TYPES.has(row.type)) throw new Error("MOBILE_FORBIDDEN");
  return postCommercialDocumentForActor(actor, { documentId: id });
}

export async function mobileDeleteSale(user: MobileAppPrincipal, id: string) {
  await assertOperationalWrite(user.companyId);
  await reversePostedSaleForActor(permit(user,"ACCOUNT_JOURNAL_POST"),id);
  return {ok:true};
}
export async function mobileReplaceSale(user:MobileAppPrincipal,id:string,raw:unknown){
  await assertOperationalWrite(user.companyId);
  const actor=permit(user,"ACCOUNT_JOURNAL_POST");
  const replacement=await replacePostedSaleForActor(actor,id,raw);
  return getCommercialDocumentForActor(actor,replacement.id);
}

export async function mobileCustomerReceipt(
  user: MobileAppPrincipal,
  raw: unknown,
) {
  const actor = permit(user, "ACCOUNT_SETTLEMENT_ENTRY");
  await assertOperationalWrite(user.companyId);
  if ((raw as { action?: string })?.action === "APPLY_ADVANCE")
    return applyAdvanceForActor(actor, (raw as { payload?: unknown }).payload);
  if (
    !["CUSTOMER_RECEIPT", "CUSTOMER_ADVANCE"].includes(
      String((raw as { type?: string })?.type),
    )
  )
    throw new Error("INVALID_INPUT");
  return createSettlementForActor(actor, raw);
}
export async function mobileCustomerReceiptContext(user: MobileAppPrincipal) {
  const actor = permit(user, "ACCOUNT_SETTLEMENT_ENTRY"),
    scope =
      actor.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: actor.branchIds ?? [] } }
        : {},
    [customers, branches, moneyAccounts, projects, documents, receipts] =
      await Promise.all([
        db.customer.findMany({
          where: {
            companyId: actor.companyId,
            isActive: true,
            isAccountCustomer: true,
            ...scope,
          },
          select: { id: true, name: true, branchId: true },
          orderBy: { name: "asc" },
        }),
        db.branch.findMany({
          where: {
            companyId: actor.companyId,
            isActive: true,
            ...(actor.branchAccessScope === "SELECTED_BRANCHES"
              ? { id: { in: actor.branchIds ?? [] } }
              : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.moneyAccount.findMany({
          where: { companyId: actor.companyId, isActive: true },
          select: { id: true, name: true, branchId: true },
          orderBy: { name: "asc" },
        }),
        listOpenProjectOptionsForActor(actor, user.productEdition),
        db.commercialDocument.findMany({
          where: {
            companyId: actor.companyId,
            type: "SALES_INVOICE",
            status: "POSTED",
            ...scope,
          },
          select: {
            id: true,
            branchId: true,
            customerId: true,
            projectId: true,
            documentNumber: true,
            grandTotal: true,
            payableAmount: true,
          },
          orderBy: { issueDate: "desc" },
        }),
        db.accountSettlement.findMany({
          where: {
            companyId: actor.companyId,
            type: { in: ["CUSTOMER_RECEIPT", "CUSTOMER_ADVANCE"] },
            ...scope,
          },
          select: {
            id: true,
            type: true,
            branchId: true,
            customerId: true,
            projectId: true,
            settlementNumber: true,
            transactionDate: true,
            amount: true,
            paymentMode: true,
            reference: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 100,
        }),
      ]),
    outstanding = await documentOutstandingsBatch(actor.companyId, documents);
  const enabled = await enabledModulesForCompany(actor.companyId),
    allowedTypes = [
      ...(enabled.includes("SALES") && enabled.includes("CUSTOMER_RECEIPTS")
        ? ["CUSTOMER_RECEIPT"]
        : []),
      ...(enabled.includes("SALES") && enabled.includes("CUSTOMER_ADVANCES")
        ? ["CUSTOMER_ADVANCE", "APPLY_ADVANCE"]
        : []),
    ],
    advances = allowedTypes.includes("APPLY_ADVANCE")
      ? await db.accountSettlement.findMany({
          where: {
            companyId: actor.companyId,
            type: "CUSTOMER_ADVANCE",
            remainingAmount: { gt: 0 },
            ...scope,
          },
          select: {
            id: true,
            branchId: true,
            customerId: true,
            projectId: true,
            settlementNumber: true,
            remainingAmount: true,
          },
          orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
          take: 100,
        })
      : [];
  return {
    allowedTypes,
    advances,
    customers,
    branches,
    moneyAccounts,
    projects,
    documents: documents
      .map((x) => ({
        ...x,
        outstanding: outstanding.get(x.id)?.toString() ?? "0",
      }))
      .filter((x) => x.outstanding !== "0"),
    receipts,
    discountDuringPayment:((await db.accountSettings.findUnique({where:{companyId:actor.companyId},select:{transactionDefaults:true}}))?.transactionDefaults as {transactionPreferences?:{discountDuringPayment?:boolean}}|null)?.transactionPreferences?.discountDuringPayment===true,
  };
}
