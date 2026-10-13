import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { requireAccountModules } from "./modules";
import { resolveItemSettings } from "./item-settings-policy";
import { unitSchema } from "./validation";
import type { ProjectActor } from "./projects";

export async function assertUnitAccess(
  actor: ProjectActor,
  tx?: Prisma.TransactionClient,
) {
  if (
    !actor.companyId ||
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_STOCK")
  )
    throw new AuthorizationError();
  await requireAccountModules(actor, "INVENTORY");
  const settings = await (tx ?? db).accountSettings.findUnique({
    where: { companyId: actor.companyId },
    select: { itemSettings: true },
  });
  const policy = resolveItemSettings(settings?.itemSettings);
  if (!policy.enabled || !policy.itemUnits) throw new AuthorizationError();
  return (settings?.itemSettings ?? {}) as Prisma.JsonObject;
}
export async function saveUnitForActor(
  actor: ProjectActor,
  raw: unknown,
  id?: string,
) {
  const input = unitSchema.strict().parse(raw);
  if (id) z.string().uuid().parse(id);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":account-settings"}))`;
      await assertUnitAccess(actor, tx);
      const previous = id
        ? await tx.accountUnit.findFirst({
            where: { id, companyId: actor.companyId },
          })
        : null;
      if (id && !previous) throw new AuthorizationError();
      const unit = previous
        ? await tx.accountUnit.update({
            where: { id: previous.id },
            data: input,
          })
        : await tx.accountUnit.create({
            data: { companyId: actor.companyId, ...input },
          });
      await tx.accountOperationalAudit.create({
        data: {
          companyId: actor.companyId,
          actorUserId: actor.id,
          eventType: previous ? "UNIT_UPDATED" : "UNIT_CREATED",
          entityType: "UNIT",
          entityId: unit.id,
          metadata: {
            before: previous
              ? { name: previous.name, symbol: previous.symbol }
              : null,
            after: input,
          },
        },
      });
      return unit;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new Error("UNIT_NAME_OR_SYMBOL_EXISTS");
    throw error;
  }
}
export const unitConversionInput = z
  .object({
    baseUnitId: z.string().uuid(),
    secondaryUnitId: z.string().uuid(),
    rate: z
      .union([z.string(), z.number()])
      .transform(String)
      .pipe(z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/))
      .refine((value) => new Prisma.Decimal(value).gt(0)),
  })
  .strict()
  .refine((input) => input.baseUnitId !== input.secondaryUnitId);
export async function saveUnitConversionForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  const input = unitConversionInput.parse(raw),
    conversion = { ...input, rate: new Prisma.Decimal(input.rate).toFixed() };
  return db.$transaction(async (tx) => {
    // Every item-settings writer shares this lock: append/replace one rule without
    // overwriting another rule or a concurrently changed settings section.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":account-settings"}))`;
    const current = await assertUnitAccess(actor, tx);
    if (
      (await tx.accountUnit.count({
        where: {
          companyId: actor.companyId,
          id: { in: [input.baseUnitId, input.secondaryUnitId] },
          isActive: true,
        },
      })) !== 2
    )
      throw new Error("INVALID_UNIT");
    const rules = Array.isArray(current.unitConversions)
      ? current.unitConversions
      : [];
    const previous =
      rules.find(
        (rule) =>
          rule &&
          typeof rule === "object" &&
          !Array.isArray(rule) &&
          rule.baseUnitId === input.baseUnitId &&
          rule.secondaryUnitId === input.secondaryUnitId,
      ) ?? null;
    const next = rules.filter(
      (rule) =>
        !(
          rule &&
          typeof rule === "object" &&
          !Array.isArray(rule) &&
          rule.baseUnitId === input.baseUnitId &&
          rule.secondaryUnitId === input.secondaryUnitId
        ),
    );
    const itemSettings = {
      ...current,
      unitConversions: [...next, conversion],
    } as Prisma.InputJsonObject;
    const settings = await tx.accountSettings.upsert({
      where: { companyId: actor.companyId },
      create: { companyId: actor.companyId, itemSettings },
      update: { itemSettings },
    });
    await tx.accountOperationalAudit.create({
      data: {
        companyId: actor.companyId,
        actorUserId: actor.id,
        eventType: "UNIT_CONVERSION_SAVED",
        entityType: "ACCOUNT_SETTINGS",
        entityId: actor.companyId,
        metadata: { before: previous, after: conversion },
      },
    });
    return { settings, conversion };
  });
}
