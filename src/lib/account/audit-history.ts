import { z } from "zod";
import { Prisma, AccountingAuditEventType } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";

import { redactAuditMetadata } from "./audit-redaction";

type AuditActor = {
  id: string;
  companyId: string;
  accountRole?: string | null;
};
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date");
const querySchema = z
  .object({
    cursor: z.string().max(400).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    from: date.optional(),
    to: date.optional(),
    eventType: z.nativeEnum(AccountingAuditEventType).optional(),
    entityType: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_]{1,100}$/)
      .optional(),
    actorId: z.string().guid().optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "End date precedes start date",
    path: ["to"],
  });
const cursorSchema = z
  .object({ id: z.string().guid(), createdAt: z.iso.datetime() })
  .strict();
function decodeCursor(cursor: string) {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
  } catch {
    throw new Error("INVALID_AUDIT_CURSOR");
  }
}
/** Company-wide events have no branch column. Current database authority is mandatory. */
export async function requireAuditReader(actor: AuditActor) {
  if (actor.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const reader = await db.user.findFirst({
    where: {
      id: actor.id,
      companyId: actor.companyId,
      isActive: true,
      accountAccessActive: true,
      accountRole: "ACCOUNT_ADMIN",
      branchAccessScope: "ALL_BRANCHES",
      role: { not: "SUPER_ADMIN" },
    },
    select: { id: true },
  });
  if (!reader) throw new AuthorizationError();
}
export async function auditHistoryPageForActor(
  actor: AuditActor,
  raw: unknown = {},
) {
  await requireAuditReader(actor);
  const q = querySchema.parse(raw),
    cursor = q.cursor ? decodeCursor(q.cursor) : null;
  const end = q.to ? new Date(`${q.to}T00:00:00+05:30`) : null;
  if (end) end.setTime(end.getTime() + 86400000);
  const where: Prisma.AccountingAuditEventWhereInput = {
    companyId: actor.companyId,
    ...(q.eventType ? { eventType: q.eventType } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.actorId ? { actorUserId: q.actorId } : {}),
    ...(q.from || end
      ? {
          createdAt: {
            ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}),
            ...(end ? { lt: end } : {}),
          },
        }
      : {}),
    ...(cursor
      ? {
          AND: [
            {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            },
          ],
        }
      : {}),
  };
  const records = await db.accountingAuditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.pageSize + 1,
    select: {
      id: true,
      eventType: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { name: true } },
      metadata: true,
    },
  });
  const rows = records
    .slice(0, q.pageSize)
    .map((row) => ({ ...row, metadata: redactAuditMetadata(row.metadata) }));
  const last = rows.at(-1);
  return {
    rows,
    nextCursor:
      records.length > q.pageSize && last
        ? Buffer.from(
            JSON.stringify({
              id: last.id,
              createdAt: last.createdAt.toISOString(),
            }),
          ).toString("base64url")
        : null,
  };
}
