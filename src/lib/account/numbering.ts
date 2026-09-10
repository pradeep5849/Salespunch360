import { Prisma } from "@prisma/client";

type NumberingTx = Pick<Prisma.TransactionClient, "numberingSeries" | "$queryRaw">;
export type NumberingAllocation = {
  companyId: string;
  branchId?: string;
  seriesId?: string;
  seriesKey?: string;
  defaults?: { prefix?: string; suffix?: string; padding?: number };
};

/** The one transaction-aware allocator shared by Account and all future documents. */
export async function allocateDocumentNumberInTx(tx: NumberingTx, input: NumberingAllocation) {
  const { companyId, branchId, seriesId, seriesKey, defaults = {} } = input;
  if ((!seriesId && !seriesKey) || (seriesId && seriesKey)) throw new Error("INVALID_NUMBERING_SELECTOR");
  let id = seriesId;
  if (seriesKey) {
    if (!branchId) throw new Error("BRANCH_REQUIRED");
    const series = await tx.numberingSeries.upsert({
      where: { companyId_branchId_seriesKey: { companyId, branchId, seriesKey } },
      create: { companyId, branchId, seriesKey, prefix: defaults.prefix ?? "", suffix: defaults.suffix ?? "", padding: defaults.padding ?? 5 },
      update: {}, select: { id: true },
    });
    id = series.id;
  }
  const rows = await tx.$queryRaw<Array<{ prefix: string; suffix: string; padding: number; allocated: bigint }>>(Prisma.sql`
    UPDATE numbering_series SET "nextSequence"="nextSequence"+1, "updatedAt"=NOW()
    WHERE id=${id!}::uuid AND "companyId"=${companyId}::uuid AND "isActive"=TRUE
      AND "branchId" IS NOT DISTINCT FROM ${branchId ?? null}::uuid
    RETURNING prefix,suffix,padding,"nextSequence"-1 AS allocated`);
  if (rows.length !== 1) throw new Error("NUMBERING_SERIES_NOT_FOUND");
  const row = rows[0];
  return `${row.prefix}${row.allocated.toString().padStart(row.padding, "0")}${row.suffix}`;
}
