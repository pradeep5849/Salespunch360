import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { verifyFirebasePhoneProof } from "@/lib/auth/firebase-phone-verification";
import { assertTrustedOrigin, consumeRateLimit, requestFingerprint } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  idToken: z.string().min(1).max(8192),
}).strict();

/** Bind a fresh Firebase phone proof to the authenticated account.
 * Does not itself send SMS or bypass the separate first-use access gate.
 */
export async function POST(request: Request) {
  if (process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED !== "true") {
    return NextResponse.json({ error: "NOT_ENABLED" }, { status: 503 });
  }
  if (!request.headers.get("origin")) {
    return NextResponse.json({ error: "ORIGIN_REQUIRED" }, { status: 403 });
  }
  try {
    await assertTrustedOrigin();
  } catch {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const principal = await getAuthenticatedUser();
  if (!principal || !principal.companyId || principal.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!await consumeRateLimit(await requestFingerprint("phone-otp-confirm", principal.id), 10, 15 * 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  let proof;
  try {
    proof = await verifyFirebasePhoneProof(parsed.data.idToken, parsed.data.phone);
  } catch {
    return NextResponse.json({ error: "INVALID_PHONE_PROOF" }, { status: 400 });
  }
  try {
    // Serializes competing bindings for the same Firebase UID and account.
    // A verified identity cannot be reassigned to a different SalesPunch user.
    await db.$transaction(async (tx) => {
      // Lock both identity keys in a deterministic order across app instances.
      const lockKeys = [`firebase-uid:${proof.firebaseUid}`, `verified-phone:${proof.phoneNumber}`].sort();
      for (const key of lockKeys) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      }
      const existing = await tx.user.findUnique({
        where: { firebasePhoneUid: proof.firebaseUid },
        select: { id: true },
      });
      if (existing && existing.id !== principal.id) throw new Error("PHONE_IDENTITY_IN_USE");
      const phoneOwner = await tx.user.findFirst({
        where: { phone: proof.phoneNumber, phoneVerifiedAt: { not: null }, id: { not: principal.id } },
        select: { id: true },
      });
      if (phoneOwner) throw new Error("PHONE_IDENTITY_IN_USE");
      const user = await tx.user.findUnique({
        where: { id: principal.id },
        select: { id: true, companyId: true, phoneVerifiedAt: true, firebasePhoneUid: true },
      });
      if (!user || user.companyId !== principal.companyId) throw new Error("UNAUTHORIZED");
      // Changing an already verified number requires a separate recovery flow.
      if (user.phoneVerifiedAt && user.firebasePhoneUid !== proof.firebaseUid) {
        throw new Error("PHONE_CHANGE_REQUIRES_RECOVERY");
      }
      await tx.user.update({
        where: { id: principal.id },
        data: { phone: proof.phoneNumber, phoneVerifiedAt: proof.verifiedAt, firebasePhoneUid: proof.firebaseUid },
      });
    });
  } catch (error) {
    if (error instanceof Error && ["PHONE_IDENTITY_IN_USE", "PHONE_CHANGE_REQUIRES_RECOVERY"].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "PHONE_CONFIRMATION_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
}
