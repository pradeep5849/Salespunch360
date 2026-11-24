import { getAuthenticatedUser } from "@/lib/auth/session";
import { authenticatedHome } from "@/lib/auth/routing";
import { db } from "@/lib/db";
import { requiresFirstUsePhoneVerification } from "@/lib/auth/first-use-phone-policy";
/** Recovery checks existing cookie authentication only; never creates a session. */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const phoneState = user && process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED === "true" && user.companyId && user.role !== "SUPER_ADMIN"
      ? await db.user.findUnique({ where: { id: user.id }, select: { role: true, companyId: true, phone: true, phoneVerifiedAt: true } })
      : null;
    const redirectTo = user
      ? phoneState && requiresFirstUsePhoneVerification(phoneState) ? "/verify-mobile" : authenticatedHome(user)
      : undefined;
    return Response.json(
      {
        authenticated: Boolean(user),
        ...(redirectTo ? { redirectTo } : {}),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Session confirmation is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
