import { db } from "@/lib/db";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { authenticateMobileToken, mobileCan } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
import { consumeRateLimit } from "@/lib/security/request";

async function principal(request: Request) {
  const user = await authenticateMobileToken(request.headers.get("authorization"));
  if (!mobileCan(user, "SALES_USER_ADMIN")) throw new Error("MOBILE_FORBIDDEN");
  return user;
}

function failure(error: unknown) {
  const expected = mobileUnauthorized(error);
  if (expected) return expected;
  return mobileUnexpected("MOBILE_EMAIL_VERIFICATION", error);
}

export async function GET(request: Request) {
  try {
    const user = await principal(request);
    const record = await db.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
    if (!record) return mobileJson({ error: "UNAUTHORIZED" }, 401);
    return mobileJson({ verified: Boolean(record.emailVerifiedAt) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await principal(request);
    const record = await db.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true } });
    if (!record) return mobileJson({ error: "UNAUTHORIZED" }, 401);
    if (record.emailVerifiedAt) return mobileJson({ verified: true, sent: false });
    const allowed = await consumeRateLimit(`email-verification:${user.id}`, 3, 60 * 60_000);
    if (!allowed) return mobileJson({ verified: false, sent: false, message: "Try again later." });
    try {
      await issueEmailVerification(user.id, record.email);
    } catch {
      return mobileJson({ error: "EMAIL_SEND_FAILED" }, 503);
    }
    return mobileJson({ verified: false, sent: true });
  } catch (error) {
    return failure(error);
  }
}
