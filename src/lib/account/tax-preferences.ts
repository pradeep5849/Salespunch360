import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
export const taxPreferencesSchema = z
  .object({
    gst: z.boolean(),
    hsnSac: z.boolean(),
    additionalCess: z.boolean(),
    reverseCharge: z.boolean(),
    stateOfSupply: z.boolean(),
    ewayBillNumber: z.boolean(),
    compositeScheme: z.boolean(),
    enableTcs: z.boolean(),
    enableTds: z.boolean(),
    compositionCategory: z
      .enum(["MANUFACTURING", "TRADER_GOODS", "RESTAURANT"])
      .optional(),
  })
  .strict();
export async function saveTaxPreferences(
  actor: { id: string; companyId: string | null; accountRole?: string | null },
  raw: unknown,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  const p = taxPreferencesSchema.parse(raw);
  if (p.compositeScheme && !p.compositionCategory)
    throw new Error("COMPOSITION_CATEGORY_REQUIRED");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId! + ":account-settings"}))`;
    const current = await tx.accountSettings.findUnique({
        where: { companyId: actor.companyId! },
      }),
      defaults =
        (current?.transactionDefaults as Record<string, unknown> | null) ?? {},
      items = (current?.itemSettings as Record<string, unknown> | null) ?? {},
      prefs =
        (defaults.transactionPreferences as
          Record<string, unknown> | undefined) ?? {};
    const data = {
      transactionDefaults: {
        ...defaults,
        taxPreferences: p,
        transactionPreferences: {
          ...prefs,
          transactionTax: p.gst,
          reverseCharge: p.reverseCharge,
          stateOfSupply: p.stateOfSupply,
          ewayBillNumber: p.ewayBillNumber,
        },
      } as Prisma.InputJsonValue,
      itemSettings: {
        ...items,
        itemWiseTax: p.gst,
        hsnSac: p.hsnSac,
        additionalCess: p.additionalCess,
      } as Prisma.InputJsonValue,
      gstRegistrationType: p.compositeScheme
        ? ("COMPOSITION" as const)
        : p.gst
          ? current?.gstRegistrationType === "SEZ"
            ? ("SEZ" as const)
            : ("REGULAR" as const)
          : ("UNREGISTERED" as const),
      compositionEnabled: p.compositeScheme,
    };
    const saved = await tx.accountSettings.upsert({
      where: { companyId: actor.companyId! },
      create: { companyId: actor.companyId!, ...data },
      update: data,
    });
    await tx.accountingAuditEvent.create({
      data: {
        companyId: actor.companyId!,
        actorUserId: actor.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "ACCOUNT_SETTINGS",
        entityId: actor.companyId!,
        metadata: { sections: ["TAX_GST"], preferences: p },
      },
    });
    return saved;
  });
}
