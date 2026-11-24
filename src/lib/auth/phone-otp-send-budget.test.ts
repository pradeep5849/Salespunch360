import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const rows: { phoneHash: string; createdAt: Date }[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    phoneOtpSend: {
      findMany: vi.fn(async ({ where }: { where: { phoneHash: string; createdAt: { gt: Date; lte: Date } } }) =>
        rows.filter((row) => row.phoneHash === where.phoneHash &&
          row.createdAt > where.createdAt.gt && row.createdAt <= where.createdAt.lte)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())),
      create: vi.fn(async ({ data }: { data: { phoneHash: string; createdAt: Date } }) => {
        rows.push(data);
        return data;
      }),
    },
  };
  return { rows, tx, transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)) };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mock.transaction } }));

import { PhoneOtpSendLimitError, reservePhoneOtpSend } from "./phone-otp-send-budget";

const phone = "+919876543210";
const start = new Date("2026-11-23T12:00:00.000Z");

describe("atomic phone OTP send reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.rows.length = 0;
    process.env.PHONE_OTP_HASH_SECRET = "test-secret-at-least-thirty-two-characters";
  });

  it("rejects invalid numbers before database access", async () => {
    await expect(reservePhoneOtpSend("9876543210", start)).rejects.toThrow("INVALID_PHONE_NUMBER");
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("fails closed without a secure HMAC secret", async () => {
    delete process.env.PHONE_OTP_HASH_SECRET;
    await expect(reservePhoneOtpSend(phone, start)).rejects.toThrow("PHONE_OTP_NOT_CONFIGURED");
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("reserves two sends with cooldown, then blocks a third", async () => {
    await expect(reservePhoneOtpSend(phone, start)).resolves.toEqual({ remaining: 1 });
    await expect(reservePhoneOtpSend(phone, new Date(start.getTime() + 30_000)))
      .rejects.toMatchObject({ retryAfterSeconds: 30 });
    await expect(reservePhoneOtpSend(phone, new Date(start.getTime() + 60_000)))
      .resolves.toEqual({ remaining: 0 });
    await expect(reservePhoneOtpSend(phone, new Date(start.getTime() + 120_000)))
      .rejects.toBeInstanceOf(PhoneOtpSendLimitError);
    expect(mock.tx.phoneOtpSend.create).toHaveBeenCalledTimes(2);
    expect(mock.rows[0].phoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mock.rows[0].phoneHash).not.toContain(phone);
    expect(mock.tx.$executeRaw).toHaveBeenCalled();
  });

  it("tracks different numbers independently", async () => {
    await reservePhoneOtpSend(phone, start);
    await expect(reservePhoneOtpSend("+919876543211", start))
      .resolves.toEqual({ remaining: 1 });
    expect(mock.rows[0].phoneHash).not.toBe(mock.rows[1].phoneHash);
  });

  it("allows a new send after the 24-hour rolling window expires", async () => {
    await reservePhoneOtpSend(phone, start);
    await reservePhoneOtpSend(phone, new Date(start.getTime() + 60_000));
    await expect(reservePhoneOtpSend(phone, new Date(start.getTime() + 86_400_000)))
      .resolves.toEqual({ remaining: 0 });
  });
});
