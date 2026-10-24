import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { assertInventoryAvailable } from "./inventory";
import {
  assertItemSettings,
  resolveItemSettings,
} from "./item-settings-policy";

const inputSchema = z
  .object({
    key: z.enum([
      "customFields",
      "additionalFields",
      "wholesalePrice",
      "barcodeScanning",
      "itemCategory",
      "description",
    ]),
    value: z.boolean(),
  })
  .strict();
/** Change one setting under the same company lock as the full settings editor. */
export async function updateQuickItemSettingForActor(
  actor: { id: string; companyId: string | null; accountRole?: string | null },
  raw: unknown,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  const input = inputSchema.parse(raw);
  await assertInventoryAvailable(actor);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId! + ":account-settings"}))`;
    const row = await tx.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { itemSettings: true },
    });
    const before = (row?.itemSettings as Record<string, unknown> | null) ?? {};
    const resolved = resolveItemSettings({
      ...before,
      [input.key]: input.value,
    });
    if (!resolved.enabled) throw new Error("ITEMS_DISABLED");
    assertItemSettings(resolved);
    const after = { ...before, ...resolved } as Prisma.InputJsonValue;
    await tx.accountSettings.upsert({
      where: { companyId: actor.companyId! },
      create: { companyId: actor.companyId!, itemSettings: after },
      update: { itemSettings: after },
    });
    await tx.accountingAuditEvent.create({
      data: {
        companyId: actor.companyId!,
        actorUserId: actor.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "ACCOUNT_SETTINGS",
        entityId: actor.companyId!,
        metadata: {
          sections: ["ITEMS"],
          before: before as Prisma.InputJsonValue,
          after,
          changedKey: input.key,
        },
      },
    });
    return resolved;
  });
}
