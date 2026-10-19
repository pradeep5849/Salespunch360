import {z} from "zod";
import {Prisma} from "@prisma/client";
import {AuthorizationError, requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "@/lib/account/modules";
import {getQuotationForActor, type QuotationActor} from "./service";
import {quotationCommercialPrefill} from "./commercial-prefill";

const input = z.object({
  documentId: z.string().uuid(),
  revisionId: z.string().uuid().optional(),
  targetType: z.enum(["SALES_INVOICE", "SALES_ORDER"]),
}).strict();

/** Read-only preparation. This is not authorization to post or close a source;
 * Save/confirmation must re-check its revision, permissions and lifecycle in tx.
 * It intentionally creates neither a persisted draft nor a conversion intent.
 */
export async function quotationConversionPreviewForActor(actor: QuotationActor, raw: unknown) {
  const request = input.parse(raw);
  if (!actor.companyId || !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_QUOTATION_VIEW")
    || !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_SALES_ENTRY")
    || (request.targetType === "SALES_INVOICE" && !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_POST"))) {
    throw new AuthorizationError();
  }
  await requireAccountModules(actor, "QUOTATIONS_BOQ", "SALES", ...(request.targetType === "SALES_ORDER" ? ["SALES_ORDER" as const] : []));
  const document = await getQuotationForActor(actor, request.documentId);
  // The underlying read is scoped too. Retain an explicit boundary here so a
  // future projection/refactor cannot turn this entry into an unscoped reader.
  if (document.companyId !== actor.companyId || (actor.branchAccessScope === "SELECTED_BRANCHES"
    && !actor.branchIds?.includes(document.branchId))) throw new AuthorizationError();
  const revision = document.revisions[0];
  if (!revision || revision.revisionNumber !== document.currentRevisionNumber
    || (request.revisionId && request.revisionId !== revision.id)) throw new Error("QUOTATION_REVISION_CHANGED");
  // Lead acceptance owns customer/Project creation. Merely opening a Sale form
  // must never create a customer or run that independent Plus workflow.
  if (!document.customerId) throw new Error("QUOTATION_CUSTOMER_REQUIRED");
  const prefill = quotationCommercialPrefill(revision.lines, revision.adjustments,{roundOffEnabled:revision.roundOffEnabled});
  for (const field of ["taxableTotal", "taxTotal", "grandTotal"] as const) {
    if (!new Prisma.Decimal(prefill[field]).equals(revision[field])) throw new Error("QUOTATION_TOTALS_STALE");
  }
  return {
    sourceDocumentId: document.id,
    sourceRevisionId: revision.id,
    sourceRevisionNumber: revision.revisionNumber,
    sourceNumber: document.documentNumber,
    sourceStatus: document.status,
    targetType: request.targetType,
    branchId: document.branchId,
    partyId: document.customerId,
    projectId: document.projectId,
    billingName: revision.customerName,
    stateOfSupplyCode:revision.stateOfSupplyCode??undefined,
    ...prefill,
    // Reference content stays separate from invoice custom fields/short notes;
    // never silently truncate the estimate's longer terms or payment schedule.
    reference: {
      terms: revision.terms,
      inclusions: revision.inclusions,
      exclusions: revision.exclusions,
      notes: revision.notes,
      paymentSchedule: revision.paymentSchedule.map(row => ({label: row.label, amount: row.amount.toFixed(2), dueDescription: row.dueDescription})),
    },
  };
}

export async function quotationConversionPreview(raw: unknown) {
  return quotationConversionPreviewForActor(await requirePermission("ACCOUNT_QUOTATION_VIEW"), raw);
}
