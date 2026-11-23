import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
import { verifyFirebasePhoneProof } from "@/lib/auth/firebase-phone-verification";
import { consumeRateLimit, requestFingerprint } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  idToken: z.string().min(1).max(8192),
}).strict();

export async function POST(request: Request) {
  if (process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED !== "true")
    return mobileJson({ error: "NOT_ENABLED" }, 503);
  let principal;
  try {
    principal = await authenticateMobileToken(request.headers.get("authorization"), new Date(), true);
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileUnexpected("MOBILE_PHONE_VERIFY_AUTH", error);
  }
  if (!await consumeRateLimit(await requestFingerprint("mobile-phone-verify", principal.id), 10, 15 * 60_000))
    return mobileJson({ error: "RATE_LIMITED" }, 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mobileJson({ error: "INVALID_INPUT" }, 400);
  let proof;
  try {
    proof = await verifyFirebasePhoneProof(parsed.data.idToken, parsed.data.phone);
  } catch {
    return mobileJson({ error: "INVALID_PHONE_PROOF" }, 400);
  }
  try {
    await db.$transaction(async (tx) => {
      const keys = [`firebase-uid:${proof.firebaseUid}`, `verified-phone:${proof.phoneNumber}`].sort();
      for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await tx.user.findUnique({ where: { firebasePhoneUid: proof.firebaseUid }, select: { id: true } });
      if (existing && existing.id !== principal.id) throw new Error("PHONE_IDENTITY_IN_USE");
      const phoneOwner = await tx.user.findFirst({
        where: { phone: proof.phoneNumber, phoneVerifiedAt: { not: null }, id: { not: principal.id } },
        select: { id: true },
      });
      if (phoneOwner) throw new Error("PHONE_IDENTITY_IN_USE");
      const user = await tx.user.findUnique({
        where: { id: principal.id },
        select: { companyId: true, phone: true, phoneVerifiedAt: true, firebasePhoneUid: true },
      });
      if (!user || user.companyId !== principal.companyId) throw new Error("UNAUTHORIZED");
      if (user.phoneVerifiedAt && (user.firebasePhoneUid !== proof.firebaseUid || user.phone !== proof.phoneNumber))
        throw new Error("PHONE_CHANGE_REQUIRES_RECOVERY");
      await tx.user.update({
        where: { id: principal.id },
        data: { phone: proof.phoneNumber, firebasePhoneUid: proof.firebaseUid, phoneVerifiedAt: proof.verifiedAt },
      });
    });
  } catch (error) {
    if (error instanceof Error && ["PHONE_IDENTITY_IN_USE", "PHONE_CHANGE_REQUIRES_RECOVERY"].includes(error.message))
      return mobileJson({ error: error.message }, 409);
    return mobileJson({ error: "PHONE_CONFIRMATION_UNAVAILABLE" }, 503);
  }
  return mobileJson({ verified: true });
}
