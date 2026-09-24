import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { allocateDocumentNumberInTx } from "@/lib/account/numbering";
import { LEGACY_DEFAULT_ACCOUNT_MODULES } from "@/lib/account/modules";

export type WonLeadProjectActor = { id: string; companyId: string };

async function wonProjectEntitled(client: Prisma.TransactionClient | typeof db, companyId: string) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { productEdition: true, accountSettings: { select: { enabledModules: true } } },
  });
  const enabledModules = company?.accountSettings?.enabledModules ?? LEGACY_DEFAULT_ACCOUNT_MODULES;
  return Boolean(company && company.productEdition === "SALESPUNCH360_PLUS" && enabledModules.includes("PROJECTS"));
}

export async function ensureWonLeadProjectInTx(
  tx: Prisma.TransactionClient,
  actor: WonLeadProjectActor,
  leadId: string,
  now = new Date(),
) {
  await tx.$queryRaw`SELECT "id" FROM "leads" WHERE "id"=${leadId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const existing = await tx.project.findFirst({
    where: { companyId: actor.companyId, sourceLeadId: leadId },
    select: { id: true, projectNumber: true },
  });
  if (existing) return existing;
  if (!await wonProjectEntitled(tx, actor.companyId)) return null;

  const lead = await tx.lead.findFirst({
    where: { id: leadId, companyId: actor.companyId, stage: "WON" },
    select: {
      id: true,
      branchId: true,
      title: true,
      companyName: true,
      contactName: true,
      phone: true,
      email: true,
      estimatedValue: true,
      customerId: true,
      assignedUserId: true,
      assignedUser: { select: { managerId: true } },
      customer: { select: { id: true, name: true, address: true, isAccountCustomer: true } },
    },
  });
  if (!lead) return null;

  let customerId = lead.customerId;
  if (customerId) {
    await tx.customer.update({ where: { id: customerId }, data: { isAccountCustomer: true } });
  } else {
    const customer = await tx.customer.create({
      data: {
        companyId: actor.companyId,
        branchId: lead.branchId,
        assignedUserId: lead.assignedUserId,
        name: (lead.companyName || lead.contactName || lead.title).trim(),
        contactPerson: lead.contactName,
        phone: lead.phone,
        email: lead.email,
        isAccountCustomer: true,
      },
    });
    customerId = customer.id;
    await tx.lead.update({ where: { id: lead.id }, data: { customerId } });
  }

  const projectNumber = await allocateDocumentNumberInTx(tx, {
    companyId: actor.companyId,
    branchId: lead.branchId,
    seriesKey: "PROJECT",
    defaults: { prefix: "PRJ-", padding: 6 },
  });
  const project = await tx.project.create({
    data: {
      companyId: actor.companyId,
      branchId: lead.branchId,
      projectNumber,
      name: lead.title.trim(),
      customerId,
      createdById: actor.id,
      status: "ACTIVE",
      startDate: now,
      projectValue: lead.estimatedValue ?? new Prisma.Decimal(0),
      sourceLeadId: lead.id,
      sourceSalesUserId: lead.assignedUserId,
      sourceSalesManagerId: lead.assignedUser.managerId,
      siteName: lead.companyName ?? undefined,
      siteAddress: lead.customer?.address ?? undefined,
      siteContactName: lead.contactName ?? undefined,
      siteContactPhone: lead.phone ?? undefined,
    },
  });
  await tx.projectAuditEvent.create({
    data: {
      companyId: actor.companyId,
      projectId: project.id,
      actorUserId: actor.id,
      eventType: "PROJECT_CREATED",
      metadata: { source: "WON_LEAD", sourceLeadId: lead.id },
    },
  });
  return { id: project.id, projectNumber: project.projectNumber };
}

export async function ensureWonLeadProjectForActor(actor: WonLeadProjectActor, leadId: string) {
  return db.$transaction(
    tx => ensureWonLeadProjectInTx(tx, actor, leadId),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Repairs historical Won leads that were committed before the project handoff
 * completed. The operation is idempotent because sourceLeadId is checked by
 * ensureWonLeadProjectInTx before creating anything.
 */
export async function reconcileWonLeadProjectsForActor(actor: WonLeadProjectActor, limit = 100) {
  if (!await wonProjectEntitled(db, actor.companyId)) return { eligible: false, created: 0 };
  const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
  const missing = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT l.id
    FROM "leads" l
    WHERE l."companyId"=${actor.companyId}::uuid
      AND l.stage='WON'
      AND NOT EXISTS (
        SELECT 1 FROM "projects" p
        WHERE p."companyId"=l."companyId" AND p."sourceLeadId"=l.id
      )
    ORDER BY l."wonAt" ASC NULLS LAST, l."createdAt" ASC
    LIMIT ${safeLimit}
  `);
  let created = 0;
  for (const lead of missing) {
    const project = await ensureWonLeadProjectForActor(actor, lead.id);
    if (project) created += 1;
  }
  return { eligible: true, created };
}
