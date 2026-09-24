import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { assertActiveTelecallerEntitlement } from "@/lib/billing/telecaller";
import { isTelecaller, SALES_HANDOFF_RESULTS, TELECALLING_RESULTS, type TelecallingResult } from "@/lib/telecalling/policy";
import type { MobilePrincipal } from "./auth";

export type MobileTelecallingLead = {
  id: string;
  title: string;
  contactName: string | null;
  phone: string | null;
  stage: string;
  assignedUserId: string;
  ownerName: string;
  calls: number;
};

export type MobileLeadCallHistoryItem = {
  id: string;
  leadId: string;
  callerUserId: string;
  callerName: string;
  result: TelecallingResult;
  notes: string | null;
  calledAt: Date;
  nextCallbackAt: Date | null;
  callbackAssigneeUserId: string | null;
};

export type MobileCallbackQueueItem = MobileLeadCallHistoryItem & {
  leadTitle: string;
  phone: string | null;
  ownerName: string;
};

export type MobileSalesActionItem = {
  id: string;
  leadId: string;
  leadTitle: string;
  phone: string | null;
  leadCallId: string;
  assignedUserId: string;
  ownerName: string;
  createdByUserId: string;
  callerName: string;
  trigger: "INTERESTED" | "WANTS_VISIT" | "WANTS_QUOTATION";
  status: "PENDING" | "ACKNOWLEDGED" | "ACTION_TAKEN";
  notes: string | null;
  calledAt: Date;
  createdAt: Date;
};

function actorLeadWhere(actor: MobilePrincipal): Prisma.LeadWhereInput {
  if (isTelecaller(actor) || actor.salesRole === "PRIMARY_ADMIN" || actor.salesRole === "ADMIN") return {};
  if (actor.salesRole === "MANAGER") {
    return actor.managerType === "MANAGER_ONLY"
      ? { assignedUser: { salesRole: "SALES", managerId: actor.id } }
      : { OR: [{ assignedUserId: actor.id }, { assignedUser: { salesRole: "SALES", managerId: actor.id } }] };
  }
  return { assignedUserId: actor.id };
}

async function assertTelecallerPackage(actor: MobilePrincipal) {
  if (isTelecaller(actor)) await assertActiveTelecallerEntitlement(actor.companyId);
}

async function assertOperationalWrite(actor: MobilePrincipal) {
  await assertTelecallerPackage(actor);
  const entitlement = await effectiveEntitlement(actor.companyId);
  if (!entitlement.operationalWritesAllowed) throw new Error("SUBSCRIPTION_REQUIRED");
}

async function accessibleLead(actor: MobilePrincipal, leadId: string) {
  const id = z.string().uuid().parse(leadId);
  await assertTelecallerPackage(actor);
  const lead = await db.lead.findFirst({
    where: { id, companyId: actor.companyId, ...actorLeadWhere(actor) },
    select: { id: true, title: true, phone: true, stage: true, assignedUserId: true, assignedUser: { select: { name: true } } },
  });
  if (!lead) throw new Error("NOT_FOUND");
  return lead;
}

export async function mobileTelecallingQueue(actor: MobilePrincipal, search?: string): Promise<MobileTelecallingLead[]> {
  await assertTelecallerPackage(actor);
  const q = search?.trim().slice(0, 100);
  const leads = await db.lead.findMany({
    where: {
      companyId: actor.companyId,
      ...actorLeadWhere(actor),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    },
    select: { id: true, title: true, contactName: true, phone: true, stage: true, assignedUserId: true, assignedUser: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  const ids = leads.map(lead => lead.id);
  const counts = ids.length
    ? await db.$queryRaw<{ leadId: string; count: bigint }[]>(Prisma.sql`
        SELECT "leadId",COUNT(*)::bigint AS count FROM "lead_calls"
        WHERE "companyId"=${actor.companyId}::uuid AND "leadId" IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
        GROUP BY "leadId"`)
    : [];
  const countByLead = new Map(counts.map(row => [row.leadId, Number(row.count)]));
  return leads.map(lead => ({
    id: lead.id,
    title: lead.title,
    contactName: lead.contactName,
    phone: lead.phone,
    stage: String(lead.stage),
    assignedUserId: lead.assignedUserId,
    ownerName: lead.assignedUser.name,
    calls: countByLead.get(lead.id) ?? 0,
  }));
}

export async function mobileLeadCallHistory(actor: MobilePrincipal, leadId: string): Promise<MobileLeadCallHistoryItem[]> {
  const lead = await accessibleLead(actor, leadId);
  return db.$queryRaw<MobileLeadCallHistoryItem[]>(Prisma.sql`
    SELECT c.id,c."leadId",c."callerUserId",u.name AS "callerName",c.result,c.notes,c."calledAt",c."nextCallbackAt",c."callbackAssigneeUserId"
    FROM "lead_calls" c JOIN "users" u ON u.id=c."callerUserId"
    WHERE c."companyId"=${actor.companyId}::uuid AND c."leadId"=${lead.id}::uuid
    ORDER BY c."calledAt" DESC LIMIT 100`);
}

export async function mobileRecordLeadCall(actor: MobilePrincipal, raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("INVALID_INPUT");
  const input = raw as Record<string, unknown>;
  const leadId = z.string().uuid().parse(input.leadId);
  const resultText = typeof input.result === "string" ? input.result : "";
  if (!(TELECALLING_RESULTS as readonly string[]).includes(resultText)) throw new Error("INVALID_CALL_RESULT");
  const result = resultText as TelecallingResult;
  const lead = await accessibleLead(actor, leadId);
  await assertOperationalWrite(actor);
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 2000) || null : null;
  const callbackRaw = typeof input.nextCallbackAt === "string" ? input.nextCallbackAt.trim() : "";
  const nextCallbackAt = result === "CALL_BACK" && callbackRaw ? new Date(callbackRaw) : null;
  if (result === "CALL_BACK" && !nextCallbackAt) throw new Error("CALLBACK_DATE_REQUIRED");
  if (nextCallbackAt && Number.isNaN(nextCallbackAt.getTime())) throw new Error("INVALID_DATE");
  if (nextCallbackAt && nextCallbackAt.getTime() <= Date.now()) throw new Error("CALLBACK_DATE_MUST_BE_FUTURE");
  const id = randomUUID();
  const handoffCreated = SALES_HANDOFF_RESULTS.has(result) && lead.assignedUserId !== actor.id;
  await db.$transaction(async tx => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "lead_calls" (id,"companyId","leadId","callerUserId",result,notes,"calledAt","nextCallbackAt","callbackAssigneeUserId","createdAt","updatedAt")
      VALUES (${id}::uuid,${actor.companyId}::uuid,${lead.id}::uuid,${actor.id}::uuid,${result},${notes},NOW(),${nextCallbackAt},${nextCallbackAt ? actor.id : null}::uuid,NOW(),NOW())`);
    if (handoffCreated) {
      const actionId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "lead_sales_actions" (id,"companyId","leadId","leadCallId","assignedUserId","createdByUserId",trigger,status,"createdAt","updatedAt")
        VALUES (${actionId}::uuid,${actor.companyId}::uuid,${lead.id}::uuid,${id}::uuid,${lead.assignedUserId}::uuid,${actor.id}::uuid,${result},'PENDING',NOW(),NOW())`);
    }
  });
  return { id, result, handoffCreated };
}

export async function mobileCallbackQueue(actor: MobilePrincipal): Promise<MobileCallbackQueueItem[]> {
  await assertTelecallerPackage(actor);
  const ownCallbacks = isTelecaller(actor) || actor.salesRole === "SALES";
  const manager = actor.salesRole === "MANAGER";
  return db.$queryRaw<MobileCallbackQueueItem[]>(Prisma.sql`
    SELECT c.id,c."leadId",c."callerUserId",u.name AS "callerName",c.result,c.notes,c."calledAt",c."nextCallbackAt",c."callbackAssigneeUserId",l.title AS "leadTitle",l.phone,owner.name AS "ownerName"
    FROM "lead_calls" c
    JOIN "leads" l ON l.id=c."leadId"
    JOIN "users" u ON u.id=c."callerUserId"
    JOIN "users" owner ON owner.id=l."assignedUserId"
    WHERE c."companyId"=${actor.companyId}::uuid AND c.result='CALL_BACK' AND c."nextCallbackAt" IS NOT NULL
    ${ownCallbacks ? Prisma.sql`AND c."callbackAssigneeUserId"=${actor.id}::uuid` : Prisma.empty}
    ${manager ? Prisma.sql`AND (l."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)` : Prisma.empty}
    AND NOT EXISTS (
      SELECT 1 FROM "lead_calls" n
      WHERE n."companyId"=c."companyId" AND n."leadId"=c."leadId" AND n."callerUserId"=c."callbackAssigneeUserId" AND n."calledAt">c."calledAt"
    )
    ORDER BY c."nextCallbackAt" ASC LIMIT 500`);
}

export async function mobileSalesActions(actor: MobilePrincipal): Promise<MobileSalesActionItem[]> {
  if (isTelecaller(actor)) return [];
  const admin = actor.salesRole === "PRIMARY_ADMIN" || actor.salesRole === "ADMIN";
  const manager = actor.salesRole === "MANAGER";
  return db.$queryRaw<MobileSalesActionItem[]>(Prisma.sql`
    SELECT a.id,a."leadId",l.title AS "leadTitle",l.phone,a."leadCallId",a."assignedUserId",owner.name AS "ownerName",a."createdByUserId",caller.name AS "callerName",a.trigger,a.status,c.notes,c."calledAt",a."createdAt"
    FROM "lead_sales_actions" a
    JOIN "lead_calls" c ON c.id=a."leadCallId"
    JOIN "leads" l ON l.id=a."leadId"
    JOIN "users" owner ON owner.id=a."assignedUserId"
    JOIN "users" caller ON caller.id=a."createdByUserId"
    WHERE a."companyId"=${actor.companyId}::uuid
    ${admin ? Prisma.empty : manager ? Prisma.sql`AND (a."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)` : Prisma.sql`AND a."assignedUserId"=${actor.id}::uuid`}
    ORDER BY CASE a.status WHEN 'PENDING' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,a."createdAt" DESC LIMIT 250`);
}

export async function mobileUpdateSalesAction(actor: MobilePrincipal, raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("INVALID_INPUT");
  if (isTelecaller(actor)) throw new Error("NOT_AUTHORIZED");
  const input = raw as Record<string, unknown>;
  const id = z.string().uuid().parse(input.actionId);
  const status = input.status;
  if (status !== "ACKNOWLEDGED" && status !== "ACTION_TAKEN") throw new Error("INVALID_STATUS");
  await assertOperationalWrite(actor);
  const rows = await db.$queryRaw<{ id: string; assignedUserId: string; ownerManagerId: string | null }[]>(Prisma.sql`
    SELECT a.id,a."assignedUserId",owner."managerId" AS "ownerManagerId"
    FROM "lead_sales_actions" a JOIN "users" owner ON owner.id=a."assignedUserId"
    WHERE a.id=${id}::uuid AND a."companyId"=${actor.companyId}::uuid LIMIT 1`);
  const row = rows[0];
  if (!row) throw new Error("NOT_FOUND");
  const supervisor = actor.salesRole === "PRIMARY_ADMIN" || actor.salesRole === "ADMIN" || (actor.salesRole === "MANAGER" && (row.assignedUserId === actor.id || row.ownerManagerId === actor.id));
  if (row.assignedUserId !== actor.id && !supervisor) throw new Error("NOT_AUTHORIZED");
  await db.$executeRaw(Prisma.sql`
    UPDATE "lead_sales_actions"
    SET status=${status},
      "acknowledgedAt"=CASE WHEN ${status}='ACKNOWLEDGED' AND "acknowledgedAt" IS NULL THEN NOW() ELSE "acknowledgedAt" END,
      "actionedAt"=CASE WHEN ${status}='ACTION_TAKEN' THEN NOW() ELSE "actionedAt" END,
      "updatedAt"=NOW()
    WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid`);
  return { ok: true };
}
