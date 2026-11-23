import { NextResponse } from "next/server";
import { z } from "zod";
import { reservePhoneOtpSend, PhoneOtpSendLimitError } from "@/lib/auth/phone-otp-send-budget";
import { assertTrustedOrigin, consumeRateLimit, requestFingerprint } from "@/lib/security/request";

export const runtime = "nodejs";
const requestSchema = z.object({ phone: z.string().regex(/^\\+[1-9]\\d{1,14}$/) }).strict();

/**
 * Best-effort application-side quota for the official Firebase Phone Auth clients.
 * This endpoint does NOT dispatch SMS or guarantee enforcement against clients
 * that invoke Firebase directly. Never expose the HMAC phone hash.
 */
export async function POST(request: Request) {
  if (process.env.PHONE_VERIFICATION_ENABLED !== "true") {
    return NextResponse.json({ error: "NOT_ENABLED" }, { status: 503 });
  }
  try {
    await assertTrustedOrigin();
  } catch {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PHONE_NUMBER" }, { status: 400 });
  }
  // IP-level protection complements the phone-level budget. This does not
  // prevent a hostile client from exhausting someone else's phone quota.
  if (!await consumeRateLimit(await requestFingerprint("phone-otp-reserve"), 5, 60 * 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const result = await reservePhoneOtpSend(parsed.data.phone);
    return NextResponse.json({ allowed: true, remaining: result.remaining }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PhoneOtpSendLimitError) {
      return NextResponse.json(
        { error: "SMS_LIMIT_REACHED", retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    // Do not leak configuration or database details to unauthenticated clients.
    return NextResponse.json({ error: "OTP_UNAVAILABLE" }, { status: 503 });
  }
}
