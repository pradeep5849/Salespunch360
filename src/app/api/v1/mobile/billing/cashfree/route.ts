import { queueCheckoutAnalytics } from "@/lib/analytics/server";
import { z } from "zod";
import { authenticateMobileSalesToken, mobileCan } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized } from "@/lib/mobile/http";
import { startCashfreeCheckout, inspectCashfreeCheckout } from "@/lib/billing/cashfree-checkout";
const schema = z.object({ orderId: z.string().uuid(), action: z.enum(["start", "verify"]), analyticsConsent:z.boolean().optional() });
export async function POST(request: Request) {
  try {
    const actor = await authenticateMobileSalesToken(request.headers.get("authorization"));
    if (!actor) return mobileJson({error:"UNAUTHORIZED"},401);
    if (!actor.companyId || actor.salesRole !== "PRIMARY_ADMIN" || !mobileCan(actor, "SALES_BILLING")) return mobileJson({ error: "FORBIDDEN" }, 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return mobileJson({ error: "INVALID_INPUT" }, 400);
    const identity = { id: actor.id, companyId: actor.companyId };
    const result = parsed.data.action === "start" ? await startCashfreeCheckout(identity, parsed.data.orderId, "android") : await inspectCashfreeCheckout(identity, parsed.data.orderId);
    if(parsed.data.action==="start") await queueCheckoutAnalytics(actor.id,actor.companyId,parsed.data.orderId,parsed.data.analyticsConsent===true);
    return mobileJson(result);
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileJson({ error: error instanceof Error && error.message === "VALID_PHONE_REQUIRED" ? "VALID_PHONE_REQUIRED" : "CHECKOUT_FAILED", message: error instanceof Error && error.message === "VALID_PHONE_REQUIRED" ? "Add a valid mobile number to your profile or company contact details before paying." : "Unable to complete checkout." }, 400);
  }
}
