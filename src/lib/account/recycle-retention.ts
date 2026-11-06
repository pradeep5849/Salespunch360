import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { retrySerializable } from "./transaction-retry";

export const RECYCLE_RETENTION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const tables = { CUSTOMER: "customers", VENDOR: "vendors", PRODUCT: "account_products", PROJECT: "projects" } as const;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
export function recyclePurgeCutoff(activatedAt: string | undefined, now = new Date()) {
  if (!activatedAt) return null;
  const activated = new Date(activatedAt);
  if (!Number.isFinite(activated.getTime()) || activated.getTime() > now.getTime() - RECYCLE_RETENTION_DAYS * DAY) return null;
  return new Date(now.getTime() - RECYCLE_RETENTION_DAYS * DAY);
}
type Reference = { schema: string; table: string; predicate: string };
async function references(tx: Prisma.TransactionClient, table: string) {
  return tx.$queryRaw<Reference[]>`
    SELECT ns.nspname AS schema,child.relname AS table,
      string_agg(format('r.%I = t.%I',childcol.attname,parentcol.attname),' AND ' ORDER BY keys.ord) AS predicate
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=child.relnamespace
    CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY AS keys(childnum,parentnum,ord)
    JOIN pg_attribute childcol ON childcol.attrelid=c.conrelid AND childcol.attnum=keys.childnum
    JOIN pg_attribute parentcol ON parentcol.attrelid=c.confrelid AND parentcol.attnum=keys.parentnum
    WHERE c.contype='f' AND c.confrelid=to_regclass('public.' || ${table})
    GROUP BY c.oid,ns.nspname,child.relname`;
}
/** No cascade cleanup: every live inbound reference, including audit history, prevents deletion. */
async function purgeOne(id: string, companyId: string, cutoff: Date, now: Date) {
  return retrySerializable(() => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
    const record = await tx.accountRecycleRecord.findFirst({where:{id,companyId,restoredAt:null,purgedAt:null,archivedAt:{lte:cutoff}}});
    if (!record) return "skipped" as const;
    const table = tables[record.entityType as keyof typeof tables];
    const retain = async (reason: string) => {
      await tx.accountRecycleRecord.update({where:{id},data:{purgeCheckedAt:now,purgeBlockedReason:reason}});
      return "retained" as const;
    };
    if (!table) return retain("UNSUPPORTED_RECORD_TYPE");
    const condition = record.entityType === "PROJECT" ? 't."archivedAt" IS NOT NULL' : 't."isActive" = false';
    const rows = await tx.$queryRawUnsafe<Array<{id:string; photo:string|null}>>(
      `SELECT t.id, ${record.entityType === "PRODUCT" ? 't."photoObjectKey"' : 'NULL::text'} AS photo FROM public.${identifier(table)} t WHERE t.id=$1::uuid AND t."companyId"=$2::uuid AND ${condition} FOR UPDATE`,record.entityId,companyId);
    if (!rows.length) return retain("RECORD_NOT_ARCHIVED_OR_MISSING");
    if (rows[0].photo) return retain("PRIVATE_FILE_HISTORY_RETAINED");
    for (const ref of await references(tx,table)) {
      // Names/predicate come exclusively from PostgreSQL's quoted FK catalog, not request input.
      const [result] = await tx.$queryRawUnsafe<Array<{linked:boolean}>>(
        `SELECT EXISTS(SELECT 1 FROM ${identifier(ref.schema)}.${identifier(ref.table)} r JOIN public.${identifier(table)} t ON ${ref.predicate} WHERE t.id=$1::uuid AND t."companyId"=$2::uuid) AS linked`,record.entityId,companyId);
      if (result.linked) return retain("LINKED_BUSINESS_OR_AUDIT_HISTORY");
    }
    // Some historical snapshot/custom-field/price references deliberately have no FK.
    const logicalColumns = record.entityType === "PRODUCT" ? ["productId","entityId"]
      : record.entityType === "PROJECT" ? ["projectId","entityId"]
      : record.entityType === "CUSTOMER" ? ["customerId","partyId","entityId"] : ["vendorId","partyId","entityId"];
    const logical = await tx.$queryRaw<Array<{table_name:string; columns:string[]}>>`
      SELECT table_name,array_agg(column_name::text) AS columns FROM information_schema.columns
      WHERE table_schema='public' AND udt_name='uuid' AND column_name IN (${Prisma.join(logicalColumns)})
        AND table_name NOT IN ('account_recycle_records','accounting_audit_events')
      GROUP BY table_name`;
    for (const ref of logical) {
      const predicate=ref.columns.map(column=>`${identifier(column)}=$1::uuid`).join(" OR ");
      const [result]=await tx.$queryRawUnsafe<Array<{linked:boolean}>>(`SELECT EXISTS(SELECT 1 FROM public.${identifier(ref.table_name)} WHERE ${predicate}) AS linked`,record.entityId);
      if(result.linked)return retain("LINKED_BUSINESS_OR_AUDIT_HISTORY");
    }
    const actor = await tx.user.findFirst({where:{id:record.archivedById,companyId},select:{id:true}});
    if (!actor) return retain("ARCHIVE_ACTOR_HISTORY_REQUIRED");
    await tx.$executeRawUnsafe(`DELETE FROM public.${identifier(table)} WHERE id=$1::uuid AND "companyId"=$2::uuid`,record.entityId,companyId);
    await tx.accountingAuditEvent.create({data:{companyId,actorUserId:actor.id,eventType:"RECORD_PURGED",entityType:record.entityType,entityId:record.entityId,reason:"Automatic seven-day Recycle Bin retention",metadata:{scheduled:true,archivedAt:record.archivedAt.toISOString(),purgedAt:now.toISOString()}}});
    await tx.accountRecycleRecord.update({where:{id},data:{purgedAt:now,purgeCheckedAt:now,purgeBlockedReason:null,displayName:"Permanently deleted record",reason:null}});
    return "purged" as const;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000}));
}
export async function purgeExpiredRecycleRecords(options: { now?: Date; limit?: number; activatedAt?: string } = {}) {
  const now=options.now ?? new Date();
  const cutoff=recyclePurgeCutoff(options.activatedAt ?? process.env.RECYCLE_PURGE_ENABLED_AT,now);
  const report={processed:0,purged:0,retained:0,skipped:0,failed:0,active:Boolean(cutoff)};
  if (!cutoff) return report;
  const limit=Math.min(100,Math.max(1,Math.trunc(options.limit ?? 25)));
  const rows=await db.accountRecycleRecord.findMany({where:{restoredAt:null,purgedAt:null,archivedAt:{lte:cutoff}},orderBy:[{purgeCheckedAt:{sort:"asc",nulls:"first"}},{archivedAt:"asc"},{id:"asc"}],take:limit,select:{id:true,companyId:true}});
  for(const row of rows) {
    report.processed++;
    try { report[await purgeOne(row.id,row.companyId,cutoff,now)]++; }
    catch {
      report.failed++;
      await db.accountRecycleRecord.updateMany({where:{id:row.id,companyId:row.companyId,restoredAt:null,purgedAt:null},data:{purgeCheckedAt:now,purgeBlockedReason:"SAFE_CLEANUP_RETRY_REQUIRED"}}).catch(()=>undefined);
    } // No record or credential details enter public job responses.
  }
  return report;
}
