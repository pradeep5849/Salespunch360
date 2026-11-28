import { z } from "zod";
import { authenticateMobileSalesToken, mobileCan } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized } from "@/lib/mobile/http";
import {
  claimCheckout,
  claimPurchase,
  productionAnalytics,
  internalCompany,
} from "@/lib/analytics/server";
const schema = z
  .object({
    eventName: z.enum(["begin_checkout", "purchase"]),
    orderId: z.string().uuid(),
    analyticsConsent: z.literal(true),
    advertisingConsent: z.boolean(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    const actor = await authenticateMobileSalesToken(
      request.headers.get("authorization"),
    );
    if (!actor) return mobileJson({ error: "UNAUTHORIZED" }, 401);
    if (
      !actor.companyId ||
      actor.salesRole !== "PRIMARY_ADMIN" ||
      !mobileCan(actor, "SALES_BILLING")
    )
      return mobileJson({ error: "FORBIDDEN" }, 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return mobileJson({ error: "INVALID_INPUT" }, 400);
    if (!productionAnalytics() || internalCompany(actor.companyId))
      return mobileJson({ eligible: false });
    const identity = { id: actor.id, companyId: actor.companyId };
    const params =
      parsed.data.eventName === "purchase"
        ? await claimPurchase(identity, parsed.data.orderId)
        : await claimCheckout(identity, parsed.data.orderId);
    return mobileJson(
      params
        ? {
            eligible: true,
            eventName: parsed.data.eventName,
            params: {
              ...params,
              environment: "production",
              ads_eligible: parsed.data.advertisingConsent ? 1 : 0,
            },
          }
        : { eligible: false },
    );
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileJson({ eligible: false });
  }
}
