import { z } from "zod";
import { authenticateMobileSalesToken, mobileCan } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized } from "@/lib/mobile/http";
import { startCashfreeCheckout, inspectCashfreeCheckout } from "@/lib/billing/cashfree-checkout";
const schema = z.object({ orderId: z.string().uuid(), action: z.enum(["start", "verify"]) });
export async function POST(request: Request) {
  try {
    const actor = await authenticateMobileSalesToken(request.headers.get("authorization"));
    if (!actor) return mobileJson({error:"UNAUTHORIZED"},401);
    if (!actor.companyId || actor.salesRole !== "PRIMARY_ADMIN" || !mobileCan(actor, "SALES_BILLING")) return mobileJson({ error: "FORBIDDEN" }, 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return mobileJson({ error: "INVALID_INPUT" }, 400);
    const identity = { id: actor.id, companyId: actor.companyId };
    const result = parsed.data.action === "start" ? await startCashfreeCheckout(identity, parsed.data.orderId, "android") : await inspectCashfreeCheckout(identity, parsed.data.orderId);
    return mobileJson(result);
  } catch (error) {
    return mobileUnauthorized(error) ?? mobileJson({ error: "CHECKOUT_FAILED" }, 400);
  }
}
