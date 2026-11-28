import { z } from "zod";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import {
  CONSENT_COOKIE,
  SITE_ORIGIN,
  hasPrivacySignal,
  parseConsent,
} from "@/lib/analytics/policy";
import {
  claimCheckout,
  claimPurchase,
  claimRegistration,
  internalCompany,
  productionAnalytics,
} from "@/lib/analytics/server";

const schema = z
  .object({
    eventName: z.enum(["sign_up", "begin_checkout", "purchase"]),
    orderId: z.string().uuid().optional(),
  })
  .strict();
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== SITE_ORIGIN)
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
  try {
    const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
    if (
      !productionAnalytics() ||
      !consent.analytics ||
      hasPrivacySignal(request.headers)
    )
      return new Response(null, { status: 204, headers });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "INVALID_REQUEST" },
        { status: 400, headers },
      );
    const user = await getAuthenticatedUser();
    if (!user?.companyId || internalCompany(user.companyId))
      return new Response(null, { status: 204, headers });
    const { eventName, orderId } = parsed.data;
    let params;
    if (eventName === "sign_up") {
      if (orderId)
        return Response.json(
          { error: "INVALID_REQUEST" },
          { status: 400, headers },
        );
      params = await claimRegistration(user.id);
    } else {
      if (!orderId)
        return Response.json(
          { error: "INVALID_REQUEST" },
          { status: 400, headers },
        );
      const actor = await requirePermissionForMutation("SALES_BILLING");
      if (!actor.companyId)
        return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
      const identity = { id: actor.id, companyId: actor.companyId };
      params =
        eventName === "purchase"
          ? await claimPurchase(identity, orderId)
          : await claimCheckout(identity, orderId);
    }
    if (!params) return new Response(null, { status: 204, headers });
    return Response.json(
      {
        eventName,
        params: {
          ...params,
          environment: "production",
          ads_eligible: consent.advertising ? 1 : 0,
        },
      },
      { headers },
    );
  } catch {
    // Telemetry is independent of payment/registration and never discloses provider diagnostics.
    return Response.json(
      { error: "ANALYTICS_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}
