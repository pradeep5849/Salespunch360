import { GoogleDriveConnectButton } from "@/components/account/google-drive-connect";
import { googleBackupStatus } from "@/lib/account/google-drive-backup";
import { BackupPreferencesFields } from "@/components/account/backup-preferences-fields";
import { AccountDate } from "@/components/account/display-preferences";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AccountPageHeader } from "@/components/account/account-shell";
import {
  SaveFeedbackForm,
  SaveSubmitButton,
} from "@/components/account/save-feedback";
import {
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { saveBackupSettings } from "@/lib/account/backup-settings";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const actor = await requirePermission("ACCOUNT_SETTINGS");
  if (actor.accountRole !== "ACCOUNT_ADMIN") throw new Error("UNAUTHORIZED");
  const row = await db.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
    }),
    root = (row?.transactionDefaults ?? {}) as Record<string, unknown>,
    settings = (root.backupSettings ?? {}) as Record<string, unknown>;
  const status = await googleBackupStatus(actor.companyId!),
    query = await searchParams;
  const messages: Record<string, string> = {
    connected: "Google Drive connected. You can now enable auto backup.",
    cancelled:
      "Google connection cancelled. Existing backup settings were kept.",
    failed:
      "Google Drive could not be connected. Try again and grant the requested access.",
    unavailable:
      "Google Drive setup is unavailable. Check the server configuration.",
    uploaded: "Backup uploaded to Google Drive. File integrity verified.",
    "in-progress":
      "A Google Drive backup is already in progress. Check the history shortly.",
    "backup-failed":
      "Backup was not confirmed on Google Drive. Check the connection, storage and internet access, then retry.",
  };
  const backups = await db.accountBackupRecord.findMany({
    where: {
      companyId: actor.companyId!,
      OR: [
        { manifest: { path: ["objectKey"], not: Prisma.AnyNull } },
        { manifest: { path: ["provider"], equals: "GOOGLE_DRIVE" } },
      ],
    },
    orderBy: { generatedAt: "desc" },
    take: 10,
  });
  async function save(fd: FormData) {
    "use server";
    try {
      await saveBackupSettings(
        await requirePermissionForMutation("ACCOUNT_SETTINGS"),
        {
          autoBackup: fd.get("autoBackup") === "on",
          intervalDays: Number(fd.get("intervalDays")),
          manualReminderDays: Number(fd.get("manualReminderDays")),
        },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "GOOGLE_DRIVE_BACKUP_NOT_CONFIGURED",
          "GOOGLE_DRIVE_BACKUP_NOT_CONNECTED",
        ].includes(error.message)
      )
        return { saveError: error.message };
      throw error;
    }
    revalidatePath("/workspace/account/settings/backup");
  }
  return (
    <>
      <AccountPageHeader
        title="Auto backup settings"
        backHref="/workspace/account/menu"
      />
      {query.google && messages[query.google] && (
        <p role="status">{messages[query.google]}</p>
      )}
      <section className="account-card">
        <p>
          {status.connected
            ? `Connected Google Drive: ${status.email}`
            : "Google Drive is not connected."}
        </p>
        <GoogleDriveConnectButton
          configured={status.configured}
          connected={status.connected}
        />
        {!status.configured && (
          <p>Google backup credentials must be configured on the server.</p>
        )}
        {status.connected && (
          <form method="post" action="/api/account/backup/google/run">
            <button>Back up to Google Drive now</button>
          </form>
        )}
      </section>
      <SaveFeedbackForm
        action={save}
        className="backup-settings-list"
        errorMessages={{
          GOOGLE_DRIVE_BACKUP_NOT_CONFIGURED:
            "Google Drive backup is not configured on the server.",
          GOOGLE_DRIVE_BACKUP_NOT_CONNECTED:
            "Connect Google Drive before enabling automatic backup.",
        }}
      >
        <BackupPreferencesFields
          connected={status.connected}
          auto={settings.autoBackup === true}
          interval={
            typeof settings.intervalDays === "number"
              ? settings.intervalDays
              : 2
          }
          reminder={
            typeof settings.manualReminderDays === "number"
              ? settings.manualReminderDays
              : 10
          }
        />
        <SaveSubmitButton>Save</SaveSubmitButton>
        <Link
          className="account-primary"
          href="/workspace/account/utilities/backup"
        >
          Open Manual Backup
        </Link>
      </SaveFeedbackForm>
      {backups.map((x) => {
        const manifest = x.manifest as Record<string, unknown>;
        return (
          <p key={x.id}>
            {manifest.provider === "GOOGLE_DRIVE" ? (
              typeof manifest.uploadedAt === "string" &&
              typeof manifest.driveFileId === "string" ? (
                <a
                  href={`https://drive.google.com/file/d/${encodeURIComponent(manifest.driveFileId)}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Drive backup —{" "}
                  <AccountDate value={manifest.uploadedAt} />
                </a>
              ) : (
                <span>
                  Google Drive backup not confirmed —{" "}
                  <AccountDate value={x.generatedAt.toISOString()} />
                </span>
              )
            ) : (
              <a download href={`/api/account/utilities/backup/${x.id}`}>
                Download previous server archive —{" "}
                <AccountDate value={x.generatedAt.toISOString()} />
              </a>
            )}
          </p>
        );
      })}
    </>
  );
}
