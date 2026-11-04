import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { updateSettingsSectionForActor } from "./settings-persistence";
import {
  assertGoogleBackupConnected,
  googleBackupStatus,
  uploadGoogleBackup,
} from "./google-drive-backup";
import { createAccountBackupForActor } from "./utilities";
export const backupSettingsSchema = z
  .object({
    autoBackup: z.boolean(),
    intervalDays: z.number().int().min(1).max(365),
    manualReminderDays: z.number().int().min(1).max(365),
  })
  .strict();
export async function saveBackupSettings(
  actor: Parameters<typeof updateSettingsSectionForActor>[0],
  raw: unknown,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  const settings = backupSettingsSchema.parse(raw);
  if (settings.autoBackup) await assertGoogleBackupConnected(actor.companyId);
  return updateSettingsSectionForActor(actor, "backupSettings", settings);
}
/** Reserve a delivery under a short company lock; snapshotting and HTTP never hold that transaction open. */
export async function runGoogleDriveBackup(
  actor: { id: string; companyId: string; accountRole: string | null },
  now = new Date(),
  force = false,
) {
  if (actor.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  await assertGoogleBackupConnected(actor.companyId);
  const reservation = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":scheduled-backup"}))`;
    const config = await tx.accountSettings.findUnique({
      where: { companyId: actor.companyId },
      select: { transactionDefaults: true },
    });
    const settings = backupSettingsSchema.safeParse(
      (config?.transactionDefaults as Record<string, unknown> | null)
        ?.backupSettings,
    );
    if (!force && (!settings.success || !settings.data.autoBackup)) return null;
    const latest = await tx.accountBackupRecord.findFirst({
      where: {
        companyId: actor.companyId,
        manifest: { path: ["provider"], equals: "GOOGLE_DRIVE" },
      },
      orderBy: { generatedAt: "desc" },
      select: { manifest: true, generatedAt: true },
    });
    const manifest =
      latest?.manifest &&
      typeof latest.manifest === "object" &&
      !Array.isArray(latest.manifest)
        ? latest.manifest
        : {};
    const age = latest
      ? now.getTime() - latest.generatedAt.getTime()
      : Infinity;
    // Fifteen-minute lease excludes overlapping workers, including repeated manual clicks.
    if (manifest.deliveryState === "IN_PROGRESS" && age < 900_000) return null;
    if (!force && latest && !manifest.uploadedAt && age < 3_600_000)
      return null;
    if (!force && settings.success) {
      const confirmed =
        typeof manifest.uploadedAt === "string"
          ? latest
          : await tx.accountBackupRecord.findFirst({
              where: {
                companyId: actor.companyId,
                AND: [
                  { manifest: { path: ["provider"], equals: "GOOGLE_DRIVE" } },
                  { manifest: { path: ["uploadedAt"], not: Prisma.AnyNull } },
                ],
              },
              orderBy: { generatedAt: "desc" },
              select: { manifest: true, generatedAt: true },
            });
      const confirmedManifest =
        confirmed?.manifest &&
        typeof confirmed.manifest === "object" &&
        !Array.isArray(confirmed.manifest)
          ? confirmed.manifest
          : {};
      if (
        typeof confirmedManifest.uploadedAt === "string" &&
        now.getTime() - Date.parse(confirmedManifest.uploadedAt) <
          settings.data.intervalDays * 86400000
      )
        return null;
    }
    const id = randomUUID(),
      pending = {
        provider: "GOOGLE_DRIVE",
        deliveryState: "IN_PROGRESS",
        attemptStartedAt: now.toISOString(),
      };
    await tx.accountBackupRecord.create({
      data: {
        id,
        companyId: actor.companyId,
        generatedById: actor.id,
        manifest: pending,
        checksum: "",
        generatedAt: now,
      },
    });
    return { id, pending };
  });
  if (!reservation) return false;
  let manifest: Record<string, unknown> = reservation.pending;
  try {
    const backup = await createAccountBackupForActor(
      actor,
      false,
      true,
      "GOOGLE_DRIVE",
      reservation.id,
    );
    manifest = backup.manifest;
    const delivery = await uploadGoogleBackup(actor.companyId, backup);
    await db.$transaction(async (tx) => {
      await tx.accountBackupRecord.update({
        where: { id: backup.id, companyId: actor.companyId },
        data: {
          manifest: {
            ...backup.manifest,
            ...delivery,
            deliveryState: "CONFIRMED",
          } as Prisma.InputJsonValue,
        },
      });
      await tx.accountingAuditEvent.create({
        data: {
          companyId: actor.companyId,
          actorUserId: actor.id,
          eventType: "BACKUP_GENERATED",
          entityType: "ACCOUNT_BACKUP_DELIVERY",
          entityId: backup.id,
          metadata: {
            phase: "DELIVERY_CONFIRMED",
            provider: delivery.provider,
            driveFileId: delivery.driveFileId,
          },
        },
      });
    });
    return true;
  } catch (error) {
    // Failed metadata is safe to show, and never suppresses reminders as a successful delivery.
    await db.accountBackupRecord
      .update({
        where: { id: reservation.id, companyId: actor.companyId },
        data: {
          manifest: {
            ...manifest,
            provider: "GOOGLE_DRIVE",
            deliveryState: "FAILED",
          } as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);
    throw error;
  }
}
export async function generateScheduledAccountBackups(now = new Date()) {
  const configs = await db.accountSettings.findMany({
    where: {
      transactionDefaults: {
        path: ["backupSettings", "autoBackup"],
        equals: true,
      },
    },
  });
  let generated = 0,
    requiresGoogleDriveSetup = 0,
    failed = 0;
  for (const config of configs) {
    if (!(await googleBackupStatus(config.companyId)).connected) {
      requiresGoogleDriveSetup++;
      continue;
    }
    const admin = await db.user.findFirst({
      where: {
        companyId: config.companyId,
        isActive: true,
        accountAccessActive: true,
        accountRole: "ACCOUNT_ADMIN",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, accountRole: true },
    });
    if (!admin) continue;
    try {
      if (
        await runGoogleDriveBackup(
          { ...admin, companyId: config.companyId },
          now,
        )
      )
        generated++;
    } catch {
      failed++;
    }
  }
  return {
    companies: configs.length,
    generated,
    requiresGoogleDriveSetup,
    failed,
  };
}
export async function backupReminderDue(companyId: string, now = new Date()) {
  const [config, latest] = await Promise.all([
    db.accountSettings.findUnique({
      where: { companyId },
      select: { transactionDefaults: true, createdAt: true },
    }),
    db.accountBackupRecord.findFirst({
      where: {
        companyId,
        OR: [
          { manifest: { path: ["provider"], equals: Prisma.AnyNull } },
          { manifest: { path: ["uploadedAt"], not: Prisma.AnyNull } },
        ],
      },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true },
    }),
  ]);
  const settings = ((
    config?.transactionDefaults as Record<string, unknown> | null
  )?.backupSettings ?? {}) as Record<string, unknown>;
  if (typeof settings.manualReminderDays !== "number") return false;
  return (
    now.getTime() -
      (latest?.generatedAt ?? config?.createdAt ?? now).getTime() >=
    settings.manualReminderDays * 86400000
  );
}
