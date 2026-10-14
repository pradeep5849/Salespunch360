import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import type { ProjectActor } from "./projects";
import {
  createCommercialDocumentForActor,
  documentOutstandingInTx,
  postCommercialDocumentForActor,
} from "./commercial";
import { ensureOpenFinancialYearForDate } from "./financial-year";
import { retrySerializable } from "./transaction-retry";
import { commercialCreationHash } from "./commercial-request-identity";
import { z } from "zod";
import { canUsePermission } from "@/lib/auth/permissions";

async function editableSaleInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  id: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const sale = await tx.commercialDocument.findFirst({
    where: { id, companyId: actor.companyId },
    include: {
      lines: { orderBy: { position: "asc" } },
      adjustments: { where: { status: "POSTED" } },
      allocations: true,
      advanceApplications: true,
    },
  });
  if (
    !sale ||
    (actor.branchAccessScope === "SELECTED_BRANCHES" &&
      !actor.branchIds?.includes(sale.branchId))
  )
    throw new AuthorizationError();
  if (
    sale.type !== "SALES_INVOICE" ||
    sale.status !== "POSTED" ||
    !sale.partyId
  )
    throw new Error("SALE_NOT_EDITABLE");
  const financial = await documentOutstandingInTx(tx, actor.companyId, sale.id);
  if (
    !financial.outstanding.eq(sale.payableAmount ?? sale.grandTotal) ||
    sale.adjustments.length ||
    sale.allocations.length ||
    sale.advanceApplications.length
  )
    throw new Error("SALE_HAS_PAYMENTS_OR_ADJUSTMENTS");
  return sale;
}
function creditPayload(
  sale: Awaited<ReturnType<typeof editableSaleInTx>>,
  date: string,
) {
  return {
    type: "CREDIT_NOTE",
    branchId: sale.branchId,
    partyId: sale.partyId!,
    sourceDocumentId: sale.id,
    issueDate: date,
    taxMode: sale.taxMode,
    stateOfSupplyCode: sale.stateOfSupplyCode ?? undefined,
    reverseCharge: sale.reverseCharge,
    projectReference: sale.projectReference ?? undefined,
    tdsRate: sale.taxableTotal.isZero()
      ? "0"
      : sale.tdsAmount.mul(100).div(sale.taxableTotal).toString(),
    tcsRate: sale.taxableTotal.isZero()
      ? "0"
      : sale.tcsAmount.mul(100).div(sale.taxableTotal).toString(),
    freightAmount: sale.freightAmount.toString(),
    otherChargesAmount: sale.otherChargesAmount.toString(),
    roundOffAmount: sale.roundOffAmount.toString(),
    lines: sale.lines.map((line) => ({
      lineType: line.lineType,
      sourceId:
        line.productId ?? line.serviceId ?? line.workPackageId ?? undefined,
      itemName: line.itemName,
      itemCode: line.itemCode ?? undefined,
      description: line.description ?? undefined,
      specification: line.specification ?? undefined,
      unitName: line.unitName ?? undefined,
      unitSymbol: line.unitSymbol ?? undefined,
      quantity: line.quantity.toString(),
      rate: line.rate.toString(),
      discountType: line.discountType ?? undefined,
      discountValue: line.discountValue?.toString() ?? undefined,
      taxRate: line.taxRate.toString(),
      cessRate: line.cessRate.toString(),
      warehouseId: line.warehouseId ?? undefined,
      batchId: line.batchId ?? undefined,
      serialNumberId: line.serialNumberId ?? undefined,
      stockReturnQuantity: line.quantity.toString(),
      sourceCommercialLineId: line.id,
    })),
  };
}
function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
async function creditInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  sale: Awaited<ReturnType<typeof editableSaleInTx>>,
) {
  const date = businessToday();
  await ensureOpenFinancialYearForDate(actor.companyId, new Date(date), tx);
  const credit = await createCommercialDocumentForActor(
    actor,
    creditPayload(sale, date),
    tx,
  );
  await postCommercialDocumentForActor(actor, { documentId: credit.id }, tx);
  const posted = await tx.commercialDocument.findUniqueOrThrow({
    where: { id: credit.id },
    select: { journalEntryId: true },
  });
  if (!sale.journalEntryId || !posted.journalEntryId)
    throw new Error("SALE_LEDGER_SOURCE_REQUIRED");
  const journals = await tx.journalEntry.findMany({
    where: {
      companyId: actor.companyId,
      id: { in: [sale.journalEntryId, posted.journalEntryId] },
      status: "POSTED",
    },
    include: { lines: true },
  });
  if (journals.length !== 2) throw new Error("SALE_REVERSAL_INCOMPLETE");
  const totals = new Map<string, Prisma.Decimal>();
  for (const journal of journals)
    for (const line of journal.lines) {
      const key = `${line.ledgerAccountId}:${line.costCentreId ?? ""}`;
      totals.set(
        key,
        (totals.get(key) ?? new Prisma.Decimal(0))
          .add(line.debit)
          .sub(line.credit),
      );
    }
  if ([...totals.values()].some((value) => !value.isZero()))
    throw new Error("SALE_REVERSAL_INCOMPLETE");
  const financial = await documentOutstandingInTx(tx, actor.companyId, sale.id);
  if (!financial.outstanding.isZero())
    throw new Error("SALE_REVERSAL_INCOMPLETE");
  return credit;
}
export function reversePostedSaleForActor(actor: ProjectActor, id: string) {
  if (
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_SALES_ENTRY") ||
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_POST")
  )
    throw new AuthorizationError();
  z.string().uuid().parse(id);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
        const prior = await tx.accountOperationalAudit.findFirst({
          where: {
            companyId: actor.companyId,
            eventType: "SALE_REVERSED",
            entityType: "SALES_INVOICE",
            entityId: id,
          },
        });
        if (prior) {
          const creditId = (prior.metadata as { creditId?: string })?.creditId;
          const credit = creditId
            ? await tx.commercialDocument.findFirst({
                where: {
                  id: creditId,
                  companyId: actor.companyId,
                  type: "CREDIT_NOTE",
                  sourceDocumentId: id,
                  status: "POSTED",
                },
              })
            : null;
          if (
            !credit ||
            (actor.branchAccessScope === "SELECTED_BRANCHES" &&
              !actor.branchIds?.includes(credit.branchId))
          )
            throw new AuthorizationError();
          return credit;
        }
        const credit = await creditInTx(
          tx,
          actor,
          await editableSaleInTx(tx, actor, id),
        );
        await tx.accountOperationalAudit.create({
          data: {
            companyId: actor.companyId,
            actorUserId: actor.id,
            eventType: "SALE_REVERSED",
            entityType: "SALES_INVOICE",
            entityId: id,
            metadata: { creditId: credit.id },
          },
        });
        return tx.commercialDocument.findUniqueOrThrow({
          where: { id: credit.id },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    ),
  );
}
export function replacePostedSaleForActor(
  actor: ProjectActor,
  id: string,
  raw: unknown,
) {
  if (
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_SALES_ENTRY") ||
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_POST")
  )
    throw new AuthorizationError();
  z.string().uuid().parse(id);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("INVALID_INPUT");
  const requestKey = z
    .string()
    .uuid()
    .parse((raw as Record<string, unknown>).idempotencyKey);
  const requestHash = commercialCreationHash({ sourceId: id, payload: raw });
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
        const prior = await tx.accountOperationalAudit.findFirst({
          where: {
            companyId: actor.companyId,
            eventType: "SALE_AMENDED",
            metadata: { path: ["requestKey"], equals: requestKey },
          },
        });
        if (prior) {
          const meta = prior.metadata as {
            requestHash?: string;
            replacementId?: string;
          };
          if (
            prior.entityId !== id ||
            meta.requestHash !== requestHash ||
            !meta.replacementId
          )
            throw new Error("IDEMPOTENCY_KEY_REUSED");
          const existing = await tx.commercialDocument.findFirst({
            where: { id: meta.replacementId, companyId: actor.companyId },
          });
          if (
            !existing ||
            (actor.branchAccessScope === "SELECTED_BRANCHES" &&
              !actor.branchIds?.includes(existing.branchId))
          )
            throw new AuthorizationError();
          return existing;
        }
        const sale = await editableSaleInTx(tx, actor, id);
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new Error("INVALID_INPUT");
        const payload: Record<string, unknown> = {
          ...(raw as Record<string, unknown>),
          type: "SALES_INVOICE",
        };
        if (payload.branchId !== sale.branchId)
          throw new Error("INVALID_BRANCH");
        // Clients may omit hidden header fields; preserve their invoice snapshots.
        const headerDefaults: Record<string, unknown> = {
          billingName: sale.billingName ?? undefined,
          customerPoNumber: sale.customerPoNumber ?? undefined,
          customerPoDate: sale.customerPoDate?.toISOString().slice(0, 10),
          transactionTime: sale.transactionTime ?? undefined,
          ewayBillNumber: sale.ewayBillNumber ?? undefined,
          notes: sale.notes ?? undefined,
          dueDate: sale.dueDate?.toISOString().slice(0, 10),
          projectId: sale.projectId ?? undefined,
          projectReference: sale.projectReference ?? undefined,
          reverseCharge: sale.reverseCharge,
          taxMode: sale.taxMode,
          stateOfSupplyCode: sale.stateOfSupplyCode ?? undefined,
          freightAmount: sale.freightAmount.toString(),
          otherChargesAmount: sale.otherChargesAmount.toString(),
          roundOffAmount: sale.roundOffAmount.toString(),
          tdsRate: sale.taxableTotal.isZero()
            ? "0"
            : sale.tdsAmount.mul(100).div(sale.taxableTotal).toString(),
          tcsRate: sale.taxableTotal.isZero()
            ? "0"
            : sale.tcsAmount.mul(100).div(sale.taxableTotal).toString(),
        };
        for (const [key, value] of Object.entries(headerDefaults))
          if (payload[key] === undefined) payload[key] = value;

        // Retained lines name an immutable line from this invoice. Never recover
        // a snapshot by position or by an ambiguous product/name match.
        const retainedLineIds = new Set<string>();
        if (Array.isArray(payload.lines))
          payload.lines = payload.lines.map((input: unknown) => {
            if (!input || typeof input !== "object" || Array.isArray(input))
              throw new Error("INVALID_INPUT");
            const line = { ...(input as Record<string, unknown>) };
            if (line.originalLineId === undefined) return line;
            const source = sale.lines.find(
              (row) => row.id === line.originalLineId,
            );
            if (
              !source ||
              retainedLineIds.has(source.id) ||
              line.lineType !== source.lineType ||
              (line.sourceId ?? null) !==
                (source.productId ?? source.serviceId ?? source.workPackageId)
            )
              throw new Error("INVALID_SALE_LINE_SOURCE");
            retainedLineIds.add(source.id);
            const defaults: Record<string, unknown> = {
              itemName: source.itemName,
              itemCode: source.itemCode ?? undefined,
              description: source.description ?? undefined,
              specification: source.specification ?? undefined,
              unitName: source.unitName ?? undefined,
              unitSymbol: source.unitSymbol ?? undefined,
              taxRate: source.taxRate.toString(),
              cessRate: source.cessRate.toString(),
              discountType: source.discountType ?? undefined,
              discountValue: source.discountValue?.toString(),
              servicePeriodDays: source.servicePeriodDays ?? undefined,
            };
            for (const [key, value] of Object.entries(defaults))
              if (line[key] === undefined) line[key] = value;
            delete line.originalLineId;
            return line;
          });

        if (payload.customFields === undefined) {
          const values = await tx.customFieldValue.findMany({
            where: {
              companyId: actor.companyId,
              entityType: "SALES_INVOICE",
              entityId: sale.id,
              definition: { isActive: true },
            },
            include: { definition: { select: { fieldKey: true } } },
          });
          payload.customFields = Object.fromEntries(
            values.map((row) => [
              row.definition.fieldKey,
              typeof row.value === "string"
                ? row.value
                : JSON.stringify(row.value),
            ]),
          );
        }
        delete payload.receivedAmount;
        delete payload.receivedInFull;
        delete payload.paymentType;
        const replacement = await createCommercialDocumentForActor(
          actor,
          payload,
          tx,
        );
        if (replacement.id === sale.id || replacement.status !== "DRAFT")
          throw new Error("SALE_REPLACEMENT_ALREADY_POSTED");
        await ensureOpenFinancialYearForDate(
          actor.companyId,
          replacement.issueDate,
          tx,
        );
        // The full credit returns stock before a replacement reuses a batch or serial.
        // Both postings and all journals/stock movements commit or roll back together.
        await creditInTx(tx, actor, sale);
        await postCommercialDocumentForActor(
          actor,
          { documentId: replacement.id },
          tx,
        );
        await tx.accountOperationalAudit.create({
          data: {
            companyId: actor.companyId,
            actorUserId: actor.id,
            eventType: "SALE_AMENDED",
            entityType: "SALES_INVOICE",
            entityId: sale.id,
            metadata: {
              requestKey,
              requestHash,
              replacementId: replacement.id,
            },
          },
        });
        return tx.commercialDocument.findUniqueOrThrow({
          where: { id: replacement.id },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    ),
  );
}
