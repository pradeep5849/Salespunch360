import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  configs: vi.fn(),
  config: vi.fn(),
  latest: vi.fn(),
  admin: vi.fn(),
  lock: vi.fn(),
  backup: vi.fn(),
  save: vi.fn(),
  connected: vi.fn(),
  status: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  create: vi.fn(),
  transactionDepth: 0,
}));
vi.mock("@/lib/db", () => ({
  db: {
    accountSettings: { findMany: m.configs, findUnique: m.config },
    accountBackupRecord: {
      findFirst: m.latest,
      update: m.update,
      create: m.create,
    },
    user: { findFirst: m.admin },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      m.transactionDepth++;
      try {
        return await fn({
          $executeRaw: m.lock,
          accountSettings: { findUnique: m.config },
          accountBackupRecord: {
            findFirst: m.latest,
            update: m.update,
            create: m.create,
          },
          accountingAuditEvent: { create: m.audit },
        });
      } finally {
        m.transactionDepth--;
      }
    },
  },
}));
vi.mock("./settings-persistence", () => ({
  updateSettingsSectionForActor: m.save,
}));
vi.mock("./utilities", () => ({ createAccountBackupForActor: m.backup }));
vi.mock("./google-drive-backup", () => ({
  assertGoogleBackupConnected: m.connected,
  googleBackupStatus: m.status,
  uploadGoogleBackup: m.upload,
}));
import {
  saveBackupSettings,
  generateScheduledAccountBackups,
  backupReminderDue,
  runGoogleDriveBackup,
} from "./backup-settings";
const actor = {
  id: "admin",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
};
const prefs = { autoBackup: true, intervalDays: 7, manualReminderDays: 7 };
beforeEach(() => {
  vi.resetAllMocks();
  m.transactionDepth = 0;
  m.update.mockResolvedValue({});
  m.configs.mockResolvedValue([
    { companyId: "company", transactionDefaults: { backupSettings: prefs } },
  ]);
  m.config.mockResolvedValue({
    transactionDefaults: { backupSettings: prefs },
  });
  m.admin.mockResolvedValue({ id: "admin", accountRole: "ACCOUNT_ADMIN" });
  m.latest.mockResolvedValue(null);
  m.status.mockResolvedValue({ configured: true, connected: true });
  m.backup.mockResolvedValue({
    id: "backup",
    bytes: new Uint8Array([1]),
    fileName: "backup.json",
    checksum: "hash",
    manifest: { provider: "GOOGLE_DRIVE" },
  });
  m.upload.mockResolvedValue({
    provider: "GOOGLE_DRIVE",
    driveFileId: "drive-file",
    uploadedAt: "2026-11-04T00:00:00.000Z",
  });
});
describe("Google Drive only backup execution", () => {
  it("validates intervals before saving", async () => {
    await expect(
      saveBackupSettings(actor, { ...prefs, intervalDays: 0 }),
    ).rejects.toThrow();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("rejects enabling automatic backup without a Google connection", async () => {
    m.connected.mockRejectedValue(
      new Error("GOOGLE_DRIVE_BACKUP_NOT_CONNECTED"),
    );
    await expect(saveBackupSettings(actor, prefs)).rejects.toThrow(
      "GOOGLE_DRIVE_BACKUP_NOT_CONNECTED",
    );
    expect(m.save).not.toHaveBeenCalled();
  });
  it("never falls back to server archives for disconnected legacy enabled settings", async () => {
    m.status.mockResolvedValue({ connected: false });
    expect(await generateScheduledAccountBackups()).toEqual({
      companies: 1,
      generated: 0,
      requiresGoogleDriveSetup: 1,
      failed: 0,
    });
    expect(m.backup).not.toHaveBeenCalled();
  });
  it("allows reminder preferences with automatic backup off", async () => {
    await saveBackupSettings(actor, { ...prefs, autoBackup: false });
    expect(m.save).toHaveBeenCalledWith(actor, "backupSettings", {
      ...prefs,
      autoBackup: false,
    });
    expect(m.connected).not.toHaveBeenCalled();
  });
  it("keeps reminders active when automatic delivery has not succeeded", async () => {
    m.config.mockResolvedValue({
      transactionDefaults: { backupSettings: prefs },
      createdAt: new Date("2026-01-01"),
    });
    expect(await backupReminderDue("company", new Date("2026-10-09"))).toBe(
      true,
    );
  });
  it("uses the most recent eligible backup to calculate reminder due", async () => {
    m.config.mockResolvedValue({
      transactionDefaults: { backupSettings: { ...prefs, autoBackup: false } },
      createdAt: new Date("2026-01-01"),
    });
    m.latest.mockResolvedValue({ generatedAt: new Date("2026-10-01") });
    expect(await backupReminderDue("company", new Date("2026-10-09"))).toBe(
      true,
    );
    expect(await backupReminderDue("company", new Date("2026-10-03"))).toBe(
      false,
    );
  });
  it("creates an attachment-inclusive bundle without archiving it on the server and records confirmed Drive delivery", async () => {
    expect(await generateScheduledAccountBackups()).toMatchObject({
      generated: 1,
      failed: 0,
    });
    expect(m.backup).toHaveBeenCalledWith(
      actor,
      false,
      true,
      "GOOGLE_DRIVE",
      expect.any(String),
      true,
    );
    expect(m.upload).toHaveBeenCalledWith(
      "company",
      expect.objectContaining({ id: "backup" }),
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "backup", companyId: "company" },
        data: {
          manifest: expect.objectContaining({
            provider: "GOOGLE_DRIVE",
            driveFileId: "drive-file",
            uploadedAt: expect.any(String),
          }),
        },
      }),
    );
    expect(m.lock).toHaveBeenCalled();
  });
  it("never marks failed uploads as successful and continues to the next company", async () => {
    m.configs.mockResolvedValue([{ companyId: "one" }, { companyId: "two" }]);
    m.upload.mockRejectedValueOnce(new Error("upload failed"));
    expect(await generateScheduledAccountBackups()).toMatchObject({
      generated: 1,
      failed: 1,
    });
    expect(m.backup).toHaveBeenCalledTimes(2);
    expect(
      m.update.mock.calls.filter(
        (call) => call[0].data.manifest.deliveryState === "CONFIRMED",
      ),
    ).toHaveLength(1);
  });
  it("does not repeat a recent confirmed Drive upload", async () => {
    m.latest.mockResolvedValue({
      manifest: { uploadedAt: "2026-11-03T00:00:00.000Z" },
      generatedAt: new Date("2026-11-03"),
    });
    expect(await runGoogleDriveBackup(actor, new Date("2026-11-04"))).toBe(
      false,
    );
    expect(m.backup).not.toHaveBeenCalled();
  });
  it("rechecks a disabled preference after acquiring the company lock", async () => {
    m.config.mockResolvedValue({
      transactionDefaults: { backupSettings: { ...prefs, autoBackup: false } },
    });
    expect(await runGoogleDriveBackup(actor)).toBe(false);
    expect(m.backup).not.toHaveBeenCalled();
  });
  it("rejects a non-administrator before connection or generation", async () => {
    await expect(
      runGoogleDriveBackup({ ...actor, accountRole: "DATA_ENTRY" }),
    ).rejects.toThrow();
    expect(m.connected).not.toHaveBeenCalled();
  });
});

it("backs off a failed pending delivery without treating it as a completed backup", async () => {
  m.latest.mockResolvedValue({
    manifest: { provider: "GOOGLE_DRIVE" },
    generatedAt: new Date("2026-11-04T00:00:00Z"),
  });
  expect(
    await runGoogleDriveBackup(actor, new Date("2026-11-04T00:15:00Z")),
  ).toBe(false);
  expect(m.backup).not.toHaveBeenCalled();
  expect(
    await runGoogleDriveBackup(actor, new Date("2026-11-04T02:00:00Z")),
  ).toBe(true);
});

it("does not keep a database transaction open during snapshot generation or Google upload", async () => {
  m.backup.mockImplementation(async () => {
    expect(m.transactionDepth).toBe(0);
    return {
      id: "backup",
      bytes: new Uint8Array([1]),
      fileName: "backup.json",
      checksum: "hash",
      manifest: { provider: "GOOGLE_DRIVE" },
    };
  });
  m.upload.mockImplementation(async () => {
    expect(m.transactionDepth).toBe(0);
    return {
      provider: "GOOGLE_DRIVE",
      driveFileId: "file",
      uploadedAt: new Date().toISOString(),
    };
  });
  expect(await runGoogleDriveBackup(actor)).toBe(true);
});
it("does not start a second manual backup while a delivery lease is active", async () => {
  m.latest.mockResolvedValue({
    manifest: { provider: "GOOGLE_DRIVE", deliveryState: "IN_PROGRESS" },
    generatedAt: new Date("2026-11-04T00:00:00Z"),
  });
  expect(
    await runGoogleDriveBackup(actor, new Date("2026-11-04T00:05:00Z"), true),
  ).toBe(false);
  expect(m.backup).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});

it("keeps the configured interval after a newer forced backup failed", async () => {
  m.latest
    .mockResolvedValueOnce({
      manifest: { provider: "GOOGLE_DRIVE", deliveryState: "FAILED" },
      generatedAt: new Date("2026-11-03T00:00:00Z"),
    })
    .mockResolvedValueOnce({
      manifest: {
        provider: "GOOGLE_DRIVE",
        uploadedAt: "2026-11-02T00:00:00Z",
      },
      generatedAt: new Date("2026-11-02"),
    });
  expect(await runGoogleDriveBackup(actor, new Date("2026-11-04"))).toBe(false);
  expect(m.backup).not.toHaveBeenCalled();
});
