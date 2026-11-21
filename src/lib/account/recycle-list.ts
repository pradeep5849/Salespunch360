import { z } from "zod";
import { db } from "@/lib/db";
const schema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), q: z.string().trim().max(160).default("") });
export async function recycleListForCompany(companyId: string, raw: unknown) {
  const query = schema.parse(raw);
  const rows = await db.accountRecycleRecord.findMany({
    where: { companyId, restoredAt: null, purgedAt: null, ...(query.q ? { displayName: { contains: query.q, mode: "insensitive" as const } } : {}) },
    orderBy: [{ archivedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * 50, take: 51,
  });
  return { items: rows.slice(0, 50), hasMore: rows.length > 50, page: query.page, q: query.q };
}
