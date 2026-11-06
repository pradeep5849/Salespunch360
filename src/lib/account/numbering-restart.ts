import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  AuthorizationError,
  AuthenticationError,
} from "@/lib/auth/authorization";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import { inAccountTransaction } from "./transaction-scope";
import { PREFIX_TYPES } from "./transaction-settings";
type Actor = { id: string; companyId: string; accountRole?: string | null };
const allowed = new Set<string>(PREFIX_TYPES.map(([key]) => key));
const prefixSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(
    /^[A-Z][A-Z0-9/_-]*[-/]$/,
    "Use an uppercase prefix ending in - or /, for example FY2026-SI/",
  );
const previewInput = z
  .object({
    seriesId: z.string().guid(),
    prefix: prefixSchema,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
const tokenInput = previewInput.extend({
  actorId: z.string().guid(),
  companyId: z.string().guid(),
  version: z.string().regex(/^[a-f0-9]{64}$/),
  requestKey: z.string().guid(),
  expiresAt: z.number().int(),
});
const confirmInput = z
  .object({ token: z.string().max(4000), confirmed: z.literal(true) })
  .strict();
type Series = Prisma.NumberingSeriesGetPayload<{
  include: { branch: { select: { name: true } } };
}>;
async function authorize(
  actor: Actor,
  client: Prisma.TransactionClient | typeof db = db,
) {
  if (
    actor.accountRole !== "ACCOUNT_ADMIN" ||
    !(await client.user.findFirst({
      where: {
        id: actor.id,
        companyId: actor.companyId,
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
        isActive: true,
        branchAccessScope: "ALL_BRANCHES",
        role: { not: "SUPER_ADMIN" },
      },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
}
function version(row: Series) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        row.id,
        row.prefix,
        row.suffix,
        row.padding,
        String(row.nextSequence),
        row.updatedAt.toISOString(),
      ]),
    )
    .digest("hex");
}
function sign(body: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}
function token(value: z.infer<typeof tokenInput>) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${sign(body)}`;
}
function readToken(value: string) {
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("NUMBERING_INVALID_REVIEW");
  const expected = Buffer.from(sign(parts[0])),
    actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("NUMBERING_INVALID_REVIEW");
  let parsed: z.infer<typeof tokenInput>;
  try {
    parsed = tokenInput.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
  } catch {
    throw new Error("NUMBERING_INVALID_REVIEW");
  }
  if (parsed.expiresAt < Date.now())
    throw new Error("NUMBERING_REVIEW_EXPIRED");
  return parsed;
}
async function series(
  client: Prisma.TransactionClient | typeof db,
  actor: Actor,
  id: string,
) {
  const row = await client.numberingSeries.findFirst({
    where: {
      id,
      companyId: actor.companyId,
      isActive: true,
      branch: { isActive: true },
    },
    include: { branch: { select: { name: true } } },
  });
  if (!row || !allowed.has(row.seriesKey) || !row.branchId)
    throw new Error("NUMBERING_SERIES_NOT_FOUND");
  if (row.padding < 1 || row.padding > 12)
    throw new Error("NUMBERING_INVALID_SERIES");
  return row;
}
async function unusedPrefix(
  client: Prisma.TransactionClient | typeof db,
  actor: Actor,
  prefix: string,
) {
  const prefixes = Array.from({ length: prefix.length }, (_, i) =>
    prefix.slice(0, i + 1),
  );
  const [reserved, document, payment, quotation] = await Promise.all([
    client.numberingSeries.findFirst({
      where: {
        companyId: actor.companyId,
        OR: [{ prefix: { startsWith: prefix, mode:"insensitive" } }, { prefix: { in: prefixes, mode:"insensitive" } }],
      },
      select: { id: true },
    }),
    client.commercialDocument.findFirst({
      where: {
        companyId: actor.companyId,
        documentNumber: { startsWith: prefix, mode:"insensitive" },
      },
      select: { id: true },
    }),
    client.accountSettlement.findFirst({
      where: {
        companyId: actor.companyId,
        settlementNumber: { startsWith: prefix, mode:"insensitive" },
      },
      select: { id: true },
    }),
    client.quotationDocument.findFirst({
      where: {
        companyId: actor.companyId,
        documentNumber: { startsWith: prefix, mode:"insensitive" },
      },
      select: { id: true },
    }),
  ]);
  if (reserved || document || payment || quotation)
    throw new Error("NUMBERING_PREFIX_ALREADY_USED");
}
export async function numberingRestartOptions(actor: Actor) {
  await authorize(actor);
  const rows = await db.numberingSeries.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      seriesKey: { in: [...allowed] },
      branch: { isActive: true },
    },
    include: { branch: { select: { name: true } } },
    orderBy: [{ branchId: "asc" }, { seriesKey: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.seriesKey,
    branch: row.branch?.name ?? "",
    prefix: row.prefix,
    suffix: row.suffix,
    padding: row.padding,
    nextSequence: String(row.nextSequence),
  }));
}
export async function previewNumberingRestart(actor: Actor, raw: unknown) {
  await authorize(actor);
  const input = previewInput.parse(raw),
    row = await series(db, actor, input.seriesId);
  await unusedPrefix(db, actor, input.prefix);
  const review = {
    ...input,
    actorId: actor.id,
    companyId: actor.companyId,
    version: version(row),
    requestKey: randomUUID(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return {
    token: token(review),
    type: row.seriesKey,
    branch: row.branch?.name ?? "",
    previousPrefix: row.prefix,
    previousNextSequence: String(row.nextSequence),
    prefix: input.prefix,
    examples: [1, 2, 3].map(
      (n) =>
        `${input.prefix}${String(n).padStart(row.padding, "0")}${row.suffix}`,
    ),
    expiresAt: new Date(review.expiresAt).toISOString(),
  };
}
export async function confirmNumberingRestart(actor: Actor, raw: unknown) {
  const input = confirmInput.parse(raw),
    review = readToken(input.token);
  if (review.actorId !== actor.id || review.companyId !== actor.companyId)
    throw new AuthorizationError();
  await assertOperationalWrite(actor.companyId);
  return inAccountTransaction(undefined, async (tx) => {
    await authorize(actor, tx);
    // Serialize namespace reservations, then use the same series row that allocation updates.
    await tx.$queryRaw`WITH numbering_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":numbering-restart"}))) SELECT 1::int AS locked FROM numbering_lock`;
    const previous = await tx.accountingAuditEvent.findFirst({
      where: {
        companyId: actor.companyId,
        entityType: "NUMBERING_SERIES",
        entityId: review.seriesId,
        eventType: "SETTINGS_CHANGED",
        metadata: { path: ["requestKey"], equals: review.requestKey },
      },
      select: { id: true },
    });
    if (previous)
      return { ok: true as const, auditId: previous.id, replayed: true };
    await tx.$queryRaw`SELECT 1::int AS locked FROM numbering_series WHERE id=${review.seriesId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
    const row = await series(tx, actor, review.seriesId);
    if (version(row) !== review.version)
      throw new Error("NUMBERING_PREVIEW_STALE");
    await unusedPrefix(tx, actor, review.prefix);
    await tx.numberingSeries.update({
      where: { id: row.id },
      data: { prefix: review.prefix, nextSequence: BigInt(1) },
    });
    const audit = await tx.accountingAuditEvent.create({
      data: {
        companyId: actor.companyId,
        actorUserId: actor.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "NUMBERING_SERIES",
        entityId: row.id,
        reason: review.reason,
        metadata: {
          operation: "NUMBERING_RESTARTED",
          requestKey: review.requestKey,
          branchId: row.branchId,
          previousPrefix: row.prefix,
          previousNextSequence: String(row.nextSequence),
          prefix: review.prefix,
          nextSequence: "1",
          historicalDocumentsPreserved: true,
        },
      },
    });
    return { ok: true as const, auditId: audit.id, replayed: false };
  });
}
export function numberingRestartFailure(error: unknown) {
  if (error instanceof AuthenticationError)
    return Response.json(
      { error: "UNAUTHORIZED", message: "Sign in before reviewing numbering." },
      { status: 401 },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "INVALID_INPUT", message: "Send a valid JSON request." },
      { status: 400 },
    );
  if (error instanceof AuthorizationError)
    return Response.json(
      {
        error: "FORBIDDEN",
        message:
          "Numbering restart requires an active all-branch Account Admin.",
      },
      { status: 403 },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "INVALID_INPUT",
        message: "Check the series, new prefix, reason and confirmation.",
      },
      { status: 400 },
    );
  const messages: Record<string, string> = {
    NUMBERING_INVALID_REVIEW: "The review is invalid. Prepare a new preview.",
    NUMBERING_REVIEW_EXPIRED: "The review expired. Prepare a new preview.",
    NUMBERING_SERIES_NOT_FOUND:
      "Select an active supported branch numbering series.",
    NUMBERING_INVALID_SERIES: "The existing series configuration needs review.",
    NUMBERING_PREFIX_ALREADY_USED:
      "Choose a completely new prefix not used by existing documents or numbering series.",
    NUMBERING_PREVIEW_STALE:
      "Numbering changed after review. Prepare a new preview before restarting.",
  };
  const code = error instanceof Error ? error.message : "";
  if (messages[code])
    return Response.json(
      { error: code, message: messages[code] },
      { status: code === "NUMBERING_PREVIEW_STALE" ? 409 : 400 },
    );
  return Response.json(
    {
      error: "NUMBERING_RESTART_FAILED",
      message: "Numbering was not changed. Retry or contact support.",
    },
    { status: 500 },
  );
}
