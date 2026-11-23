import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import {
  checkRegistrationOtpSendBudget,
  REGISTRATION_OTP_WINDOW_MS,
} from "./phone-otp-policy";

const E164 = /^\+[1-9]\d{1,14}$/;

export class PhoneOtpSendLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("PHONE_OTP_SEND_LIMIT");
  }
}

/**
 * Reserve one of two SMS sends in a rolling 24-hour window.
 * Must be called immediately before a server-controlled SMS dispatch.
 * Never expose the reservation endpoint as a client-side "permission" to
 * send SMS independently: that would permit uncounted sends.
 *
 * Failed/uncertain dispatches consume a reservation conservatively so a
 * network retry cannot produce unlimited SMS messages.
 */
export async function reservePhoneOtpSend(phone: string, now = new Date()) {
  if (!E164.test(phone)) throw new Error("INVALID_PHONE_NUMBER");
  const secret = process.env.PHONE_OTP_HASH_SECRET;
  if (!secret || secret.length < 32) throw new Error("PHONE_OTP_NOT_CONFIGURED");
  const phoneHash = createHmac("sha256", secret).update(phone).digest("hex");
  return db.$transaction(async (tx) => {
    // Serialize reservations for the same number across app instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phoneHash}))`;
    const rows = await tx.phoneOtpSend.findMany({
      where: {
        phoneHash,
        createdAt: { gt: new Date(now.getTime() - REGISTRATION_OTP_WINDOW_MS), lte: now },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const budget = checkRegistrationOtpSendBudget(
      rows.map(({ createdAt }) => ({ sentAt: createdAt })),
      now,
    );
    if (!budget.allowed) throw new PhoneOtpSendLimitError(budget.retryAfterSeconds);
    await tx.phoneOtpSend.create({
      data: { phoneHash, createdAt: now },
    });
    return { remaining: budget.remaining - 1 };
  });
}
