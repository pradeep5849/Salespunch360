import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
const decimal = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d+(\.\d{1,3})?$/)
  .transform(Number)
  .pipe(z.number().min(0).max(100));
const base = z.object({
  name: z.string().trim().min(1).max(80),
  rate: decimal,
});
export function parseTaxCatalogEntry(kind: "RATE" | "GROUP", fd: FormData) {
  const values = Object.fromEntries(
    ["name", "rate", "cgst", "sgst"].map((key) => [key, fd.get(key)]),
  );
  if (kind === "RATE") return base.parse(values);
  const value = base.extend({ cgst: decimal, sgst: decimal }).parse(values);
  if (Math.abs(value.cgst + value.sgst - value.rate) > 0.0001)
    throw new Error("TAX_GROUP_SPLIT_MUST_MATCH_RATE");
  return value;
}
export async function saveTaxCatalogEntry(
  actor: { id: string; companyId: string | null; accountRole: string | null },
  kind: "RATE" | "GROUP",
  fd: FormData,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  const value = parseTaxCatalogEntry(kind, fd),
    key = kind === "RATE" ? "customRates" : "customGroups";
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId! + ":account-settings"}))`;
    const row = await tx.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { transactionDefaults: true },
    });
    const defaults =
        (row?.transactionDefaults as Record<string, unknown> | null) ?? {},
      catalog =
        (defaults.taxCatalog as Record<string, unknown> | undefined) ?? {};
    const existing =
      (catalog[key] as Array<{ name: string }> | undefined) ?? [];
    const rest = existing.filter(
      (entry) => entry.name.toLowerCase() !== value.name.toLowerCase(),
    );
    if (rest.length >= 100) throw new Error("TAX_CATALOG_FULL");
    const transactionDefaults = {
      ...defaults,
      taxCatalog: { ...catalog, [key]: [...rest, value] },
    } as Prisma.InputJsonValue;
    await tx.accountSettings.upsert({
      where: { companyId: actor.companyId! },
      create: { companyId: actor.companyId!, transactionDefaults },
      update: { transactionDefaults },
    });
    await tx.accountingAuditEvent.create({
      data: {
        companyId: actor.companyId!,
        actorUserId: actor.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "ACCOUNT_SETTINGS",
        entityId: actor.companyId!,
        metadata: { sections: ["TAX_CATALOG"], kind, name: value.name },
      },
    });
  });
}
