import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/mailer";

const TOKEN_HOURS = 24;
export const isVerificationTokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

type Deliver = (email:string,token:string)=>Promise<void>;

/** Deliver first so an SMTP failure leaves the last delivered token usable; activation is serialized per user. */
export async function issueEmailVerification(userId: string, email: string, deliver:Deliver=sendVerificationEmail) {
  const token = randomBytes(32).toString("base64url");
  await deliver(email,token);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`email-verification:${userId}`}))`;
    await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.emailVerificationToken.create({ data: { userId, tokenHash: digest(token), expiresAt: new Date(now.getTime() + TOKEN_HOURS * 3_600_000) } });
  });
}

export async function verifyEmailToken(token: string) {
  if (!isVerificationTokenShape(token)) return false;
  const now = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash: digest(token) }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
      if (!record || record.usedAt || record.expiresAt <= now) return false;
      const verified = await tx.user.updateMany({ where: { id: record.userId, role: "COMPANY_ADMIN", emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      if (verified.count !== 1) throw new Error("VERIFICATION_USER_MISMATCH");
      const used = await tx.emailVerificationToken.updateMany({ where: { id: record.id, userId:record.userId, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (used.count !== 1) throw new Error("VERIFICATION_TOKEN_RACE");
      return true;
    });
  } catch { return false; }
}
