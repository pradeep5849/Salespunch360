import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { retrySerializable } from "./transaction-retry";
import {
  authorizedProjectBranchIds,
  projectRecordScope,
  requireProjectFunction,
  closeProjectForActor,
  type ProjectActor,
} from "./projects";
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
  documentOutstandingInTx,
  applyAdvanceForActor,
} from "./commercial";

export const projectCloseInput = z
  .object({
    billingServiceId: z.string().uuid().optional(),
    postingDate: z.coerce.date().optional(),
  })
  .strict();

/** Final billing, advance application and closure either all commit or all roll back. */
export async function closeAndBillProjectForActor(
  actor: ProjectActor,
  projectId: string,
  raw: unknown = {},
) {
  projectId = z.string().uuid().parse(projectId);
  const input = projectCloseInput.parse(raw);
  await requireProjectFunction(actor);
  const branches = await authorizedProjectBranchIds(actor);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id"=${projectId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
        const project = await tx.project.findFirst({
          where: { id: projectId, ...projectRecordScope(actor, branches) },
        });
        if (!project) throw new AuthorizationError();
        if (project.status === "CLOSED")
          return { projectId, alreadyClosed: true };
        if (!["PLANNING", "ACTIVE", "ON_HOLD"].includes(project.status))
          throw new Error("PROJECT_FINAL");
        const changes = await tx.projectChangeOrder.findMany({
          where: { companyId: actor.companyId, projectId },
        });
        if (
          changes.some((x) => ["DRAFT", "PENDING_APPROVAL"].includes(x.status))
        )
          throw new Error("PROJECT_EXTRA_JOBS_PENDING");
        const quotation = project.sourceQuotationId
          ? await tx.quotationDocument.findFirst({
              where: {
                id: project.sourceQuotationId,
                companyId: actor.companyId,
                status: "ACCEPTED",
              },
              include: {
                revisions: {
                  where: { status: "ACCEPTED" },
                  orderBy: { revisionNumber: "desc" },
                  take: 1,
                },
              },
            })
          : null;
        const contract = changes
          .filter((x) => x.status === "APPROVED")
          .reduce(
            (total, x) => total.add(x.valueDelta),
            quotation?.revisions[0]?.taxableTotal ?? project.projectValue,
          );
        const invoices = await tx.commercialDocument.findMany({
          where: {
            companyId: actor.companyId,
            projectId,
            status: "POSTED",
            type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
          },
          include: { lines: true },
          orderBy: [{ issueDate: "asc" }, { id: "asc" }],
        });
        const billed = invoices.reduce(
          (total, x) =>
            x.type === "CREDIT_NOTE"
              ? total.sub(x.taxableTotal)
              : total.add(x.taxableTotal),
          new Prisma.Decimal(0),
        );
        const balance = Prisma.Decimal.max(0, contract.sub(billed));
        const postingDate =
          input.postingDate ?? new Date(new Date().toISOString().slice(0, 10));
        let finalInvoiceId: string | null = null;
        if (balance.gt(0)) {
          const existingServices = [
            ...new Set(
              invoices
                .filter((x) => x.type === "SALES_INVOICE")
                .flatMap((x) =>
                  x.lines
                    .filter((l) => l.lineType === "SERVICE" && l.serviceId)
                    .map((l) => l.serviceId!),
                ),
            ),
          ];
          const serviceId =
            input.billingServiceId ??
            (existingServices.length === 1 ? existingServices[0] : undefined);
          if (!serviceId)
            throw new Error("PROJECT_FINAL_INVOICE_SERVICE_REQUIRED");
          const service = await tx.accountService.findFirst({
            where: {
              id: serviceId,
              companyId: actor.companyId,
              isActive: true,
            },
          });
          if (!service) throw new Error("INVALID_SERVICE");
          const intent = createHash("sha256")
            .update(
              JSON.stringify({
                contract: contract.toFixed(2),
                invoices: invoices.map((x) => x.id),
                balance: balance.toFixed(2),
              }),
            )
            .digest("hex");
          const doc = await createCommercialDocumentForActor(
            actor,
            {
              type: "SALES_INVOICE",
              branchId: project.branchId,
              partyId: project.customerId,
              projectId,
              issueDate: postingDate,
              taxMode: "EXCLUSIVE",
              idempotencyKey: `project-final:${projectId}:${intent}`,
              notes: `Final uninvoiced contract balance for ${project.projectNumber}`,
              lines: [
                {
                  lineType: "SERVICE",
                  sourceId: serviceId,
                  quantity: "1",
                  rate: balance.toFixed(2),
                  taxRate: service.taxRate?.toString() ?? "0",
                },
              ],
            },
            tx,
          );
          await postCommercialDocumentForActor(
            actor,
            { documentId: doc.id },
            tx,
          );
          finalInvoiceId = doc.id;
        }
        const targets = invoices
          .filter((x) => x.type === "SALES_INVOICE")
          .map((x) => x.id);
        if (finalInvoiceId) targets.push(finalInvoiceId);
        const advances = await tx.accountSettlement.findMany({
          where: {
            companyId: actor.companyId,
            projectId,
            branchId: project.branchId,
            customerId: project.customerId,
            type: "CUSTOMER_ADVANCE",
            status: "POSTED",
            remainingAmount: { gt: 0 },
          },
          orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
        });
        for (const advance of advances) {
          let remaining = advance.remainingAmount;
          for (const documentId of targets) {
            if (remaining.lte(0)) break;
            const { outstanding } = await documentOutstandingInTx(
              tx,
              actor.companyId,
              documentId,
            );
            const amount = Prisma.Decimal.min(remaining, outstanding);
            if (amount.lte(0)) continue;
            await applyAdvanceForActor(
              actor,
              {
                advanceId: advance.id,
                documentId,
                amount: amount.toFixed(2),
                applicationDate: postingDate,
                idempotencyKey: `close-advance:${advance.id}:${documentId}:${remaining.toFixed(2)}`,
              },
              tx,
            );
            remaining = remaining.sub(amount);
          }
        }
        await closeProjectForActor(
          actor,
          projectId,
          {
            closureNote:
              "Completed with final contract billing and available advances applied",
            billingSummary: {
              contractRevenue: contract.toFixed(2),
              previouslyInvoicedRevenue: billed.toFixed(2),
              finalInvoiceId,
              finalInvoiceRevenue: balance.toFixed(2),
            },
          },
          tx,
        );
        return { projectId, finalInvoiceId, alreadyClosed: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    ),
  );
}
