import {commercialBaseQuantity} from "./commercial-stock-quantity";
import {saleRevisionStockCostsInTx} from "./sale-revision-stock-cost";
import {retainedSaleReturnsInTx,retainedSaleReturnAmount,carrySaleReturnsInTx,saleCorrectionFamilyInTx} from "./sale-return-revisions";
import {recordSaleInvoiceIdentity} from "./sale-invoice-identity";
import {receiptAdvanceCreditInTx,advanceApplicationCreditInTx} from "./receipt-advance-credit";
import {EFFECTIVE_DOCUMENT_ALLOCATION,EFFECTIVE_ADVANCE_APPLICATION} from "./settlement-policy";
import {retainedLineDiscountValue} from "./retained-line-discount";
import {addDraftSaleAttachmentsInTx,cleanSaleAttachmentAttempts,copySaleAttachmentsInTx,prepareSaleAttachments,saleAttachmentManifest} from "./sale-attachments";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import type { ProjectActor } from "./projects";
import {
  applyAdvanceForActor,
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
  allowReturns=false,
) {
  await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const sale = await tx.commercialDocument.findFirst({
    where: { id, companyId: actor.companyId },
    include: {
      lines: { orderBy: { position: "asc" } },
      adjustments: { where: { status: "POSTED",journalEntry:{is:{status:"POSTED"}} } },
      journalEntry:{select:{status:true,entryDate:true}},
      allocations: {where:EFFECTIVE_DOCUMENT_ALLOCATION,include:{settlement:true}},
      advanceApplications: {where:EFFECTIVE_ADVANCE_APPLICATION},
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
  const priorCorrection=await tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,entityType:"SALES_INVOICE",entityId:id,eventType:{in:["SALE_AMENDED","SALE_REVERSED"]}},select:{id:true}});
  if(priorCorrection)throw new Error("SALE_ALREADY_REVISED");
  if(!sale.journalEntryId||sale.journalEntry?.status!=="POSTED")throw new Error("SALE_NOT_EDITABLE");
  const pending=await tx.settlementAllocation.count({where:{companyId:actor.companyId,documentId:sale.id,settlement:{status:"PENDING_CHEQUE"}}});
  if(pending)throw new Error("SALE_HAS_PENDING_CHEQUE");
  const financial = await documentOutstandingInTx(tx, actor.companyId, sale.id);
  const applied=sale.allocations.reduce((total,row)=>total.add(row.amount),new Prisma.Decimal(0)).add(sale.advanceApplications.reduce((total,row)=>total.add(row.amount),new Prisma.Decimal(0)));
  const retainedReturns=allowReturns?await retainedSaleReturnsInTx(tx,actor.companyId,sale.id):[];
  const retained=retainedSaleReturnAmount(retainedReturns);
  if((!allowReturns&&sale.adjustments.length)||!financial.outstanding.add(applied).add(retained).eq(sale.payableAmount??sale.grandTotal))throw new Error("SALE_HAS_PAYMENTS_OR_ADJUSTMENTS");
  return {...sale,retainedReturns};
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
    invoiceDescription: sale.invoiceDescription ?? "",
    shippingAddress: sale.shippingAddress ?? "",
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
      discountValue: retainedLineDiscountValue(line),
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
  const date = [businessToday(),sale.issueDate.toISOString().slice(0,10),...sale.allocations.map(row=>row.settlement.transactionDate.toISOString().slice(0,10)),...sale.advanceApplications.map(row=>row.applicationDate.toISOString().slice(0,10))].sort().at(-1)!;
  for(const row of sale.allocations)await receiptAdvanceCreditInTx(tx,actor,{allocationId:row.id,entryDate:date});
  for(const row of sale.advanceApplications)await advanceApplicationCreditInTx(tx,actor,{applicationId:row.id,entryDate:date});
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
  z.string().guid().parse(id);
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
        const lifecycleAudit=await tx.accountOperationalAudit.create({
          data: {
            companyId: actor.companyId,
            actorUserId: actor.id,
            eventType: "SALE_REVERSED",
            entityType: "SALES_INVOICE",
            entityId: id,
            metadata: { creditId: credit.id },
          },
        });
        await tx.saleLifecycleSnapshot.create({data:{companyId:actor.companyId,invoiceId:id,state:"CANCELLED",auditId:lifecycleAudit.id,correctionCreditId:credit.id}});
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
export async function replacePostedSaleForActor(
  actor: ProjectActor,
  id: string,
  raw: unknown,
  files: File[] = [],
) {
  if (
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_SALES_ENTRY") ||
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_POST")
  )
    throw new AuthorizationError();
  z.string().guid().parse(id);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("INVALID_INPUT");
  const requestKey = z
    .string()
    .guid()
    .parse((raw as Record<string, unknown>).idempotencyKey);
  const prepared=await prepareSaleAttachments(actor,files),attemptedKeys=new Set<string>();
  const attachmentManifest=prepared.length?saleAttachmentManifest(prepared):undefined;
  const requestHash = commercialCreationHash({ sourceId: id, payload: raw,...(attachmentManifest?{attachmentManifest}:{}) });
  try{return await retrySerializable(() =>
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
        const sale = await editableSaleInTx(tx, actor, id,true);
        const familyIds=await saleCorrectionFamilyInTx(tx,actor.companyId,sale);
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
          invoiceDescription: sale.invoiceDescription ?? "",
          billingName: sale.billingName ?? undefined,
          shippingAddress: sale.shippingAddress ?? "",
          customerPoNumber: sale.customerPoNumber ?? undefined,
          customerPoDate: sale.customerPoDate?.toISOString().slice(0, 10),
          transactionTime: sale.transactionTime ?? undefined,
          ewayBillNumber: sale.ewayBillNumber ?? undefined,
          notes: sale.notes ?? undefined,
          paymentTerms:sale.paymentTerms??undefined,
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
        const retainedUnitLineIds = new Map<number,string>();
        if (Array.isArray(payload.lines))
          payload.lines = payload.lines.map((input: unknown, position:number) => {
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
            retainedUnitLineIds.set(position,source.id);
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
              discountValue: retainedLineDiscountValue(source),
              servicePeriodDays: source.servicePeriodDays ?? undefined,
              sourceOrderLineId: source.sourceOrderLineId ?? undefined,
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
        payload.sourceSalesOrderId=sale.sourceSalesOrderId??undefined;
        delete payload.receivedAmount;
        delete payload.receivedInFull;
        delete payload.paymentType;
        const replacement = await createCommercialDocumentForActor(
          actor,
          payload,
          tx,
          {documentId:sale.id,lineIds:retainedUnitLineIds},
          attachmentManifest?commercialCreationHash({sourceSaleId:sale.id,attachmentManifest}):undefined,
        );
        if (replacement.id === sale.id || replacement.status !== "DRAFT")
          throw new Error("SALE_REPLACEMENT_ALREADY_POSTED");
        await recordSaleInvoiceIdentity(tx,actor.id,sale,replacement);
        await copySaleAttachmentsInTx(tx,actor,sale.id,replacement.id);
        await addDraftSaleAttachmentsInTx(tx,actor,replacement.id,prepared,attemptedKeys);
        // A renamed project must not rewrite an unedited invoice reference.
        // This value comes only from the authorized original document.
        if(payload.projectId===sale.projectId&&(raw as Record<string,unknown>).projectReference===undefined){
          const kept=await tx.commercialDocument.updateMany({where:{id:replacement.id,companyId:actor.companyId,status:"DRAFT"},data:{projectReference:sale.projectReference}});
          if(kept.count!==1)throw new Error("SALE_REPLACEMENT_ALREADY_POSTED");
        }

        const correctionDate=new Date([businessToday(),sale.issueDate.toISOString().slice(0,10),sale.journalEntry!.entryDate.toISOString().slice(0,10),replacement.issueDate.toISOString().slice(0,10),...sale.retainedReturns.map(item=>item.note.issueDate.toISOString().slice(0,10)),...sale.allocations.map(row=>row.settlement.transactionDate.toISOString().slice(0,10)),...sale.advanceApplications.map(row=>row.applicationDate.toISOString().slice(0,10))].sort().at(-1)!);
        await ensureOpenFinancialYearForDate(actor.companyId,correctionDate,tx);
        const stockRevision=await saleRevisionStockCostsInTx(tx,actor.companyId,sale,replacement.id);
        let correctionCreditId:string|null=null;
        if(sale.retainedReturns.length){
          for(const row of sale.allocations)await receiptAdvanceCreditInTx(tx,actor,{allocationId:row.id,entryDate:correctionDate});
          for(const row of sale.advanceApplications)await advanceApplicationCreditInTx(tx,actor,{applicationId:row.id,entryDate:correctionDate});
          await carrySaleReturnsInTx(tx,actor,sale,replacement,sale.retainedReturns,retainedUnitLineIds,correctionDate);
        }else correctionCreditId=(await creditInTx(tx,actor,sale)).id;
        const revisionLines=await tx.commercialDocumentLine.findMany({where:{companyId:actor.companyId,documentId:replacement.id},select:{id:true,position:true,quantity:true,baseQuantity:true}});
        const retainedLineBindings=revisionLines.flatMap(line=>{const originalId=retainedUnitLineIds.get(line.position);if(!originalId)return[];const original=sale.lines.find(row=>row.id===originalId);if(!original)throw new Error("INVALID_SALE_LINE_SOURCE");return[{invoiceLineId:line.id,sourceLineId:original.id,inheritServiceCompletion:sale.partyId===replacement.partyId&&sale.projectId===replacement.projectId&&commercialBaseQuantity(line).lte(commercialBaseQuantity(original))}]});
        const lifecycleAudit=await tx.accountOperationalAudit.create({
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
              retainedLineBindings,
              stockRevisionCosts:stockRevision.snapshot,
              stockRevisionCostHash:commercialCreationHash({lines:[...stockRevision.costs].map(([id,cost])=>({id,cost:cost.toFixed(2)})).sort((a,b)=>a.id.localeCompare(b.id))}),
            },
          },
        });
        await tx.saleLifecycleSnapshot.create({data:{companyId:actor.companyId,invoiceId:sale.id,state:"REVISED",auditId:lifecycleAudit.id,replacementId:replacement.id,correctionCreditId}});
        await postCommercialDocumentForActor(
          actor,
          { documentId: replacement.id },
          tx,
          {sourceInvoiceId:sale.id,postingDate:correctionDate,stockCosts:stockRevision.costs},
        );
        // Preserve actual previous payments even when automatic linking is disabled.
        // Posting may already have applied them; use current remaining/outstanding.
        if(replacement.partyId===sale.partyId&&replacement.projectId===sale.projectId){
          const related=[...familyIds,replacement.id];
          const credits=await tx.accountSettlement.findMany({where:{companyId:actor.companyId,partyId:replacement.partyId,branchId:replacement.branchId,projectId:replacement.projectId,type:"CUSTOMER_ADVANCE",status:"POSTED",paymentMode:"ACCOUNT_CREDIT",journalEntry:{is:{status:"POSTED"}},remainingAmount:{gt:0},OR:[{receiptCreditSourceAllocation:{is:{documentId:{in:related}}}},{advanceCreditSourceApplication:{is:{documentId:{in:related}}}},{saleRevisionCreditSource:{is:{revision:{invoiceId:{in:related}}}}}]},orderBy:[{transactionDate:"asc"},{createdAt:"asc"},{id:"asc"}]});
          for(const credit of credits){
            const available=await tx.accountSettlement.findUniqueOrThrow({where:{id:credit.id}});
            const financial=await documentOutstandingInTx(tx,actor.companyId,replacement.id);
            const amount=Prisma.Decimal.min(available.remainingAmount,financial.outstanding);
            if(amount.gt(0))await applyAdvanceForActor(actor,{advanceId:credit.id,documentId:replacement.id,amount:amount.toFixed(2),applicationDate:new Date(Math.max(credit.transactionDate.getTime(),correctionDate.getTime())),idempotencyKey:`sale-correction:${replacement.id}:${credit.id}`},tx);
          }
        }
        return tx.commercialDocument.findUniqueOrThrow({
          where: { id: replacement.id },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    ),
  );}finally{if(attemptedKeys.size)await cleanSaleAttachmentAttempts(actor.companyId,attemptedKeys)}
}
