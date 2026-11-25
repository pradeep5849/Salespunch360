import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { startCashfreeCheckout, inspectCashfreeCheckout } from "@/lib/billing/cashfree-checkout";
import { z } from "zod";

const schema = z.object({ orderId: z.string().uuid(), action: z.enum(["start", "verify"]) });
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== "https://www.salespunch360.com") {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
  }
  try {
    const actor = await requirePermissionForMutation("SALES_BILLING");
    if (!actor.companyId) return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const identity = { id: actor.id, companyId: actor.companyId };
    const result = parsed.data.action === "start"
      ? await startCashfreeCheckout(identity, parsed.data.orderId)
      : await inspectCashfreeCheckout(identity, parsed.data.orderId);
    return Response.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const safe = ["ORDER_NOT_PAYABLE", "VALID_PHONE_REQUIRED", "CASHFREE_SANDBOX_UNAVAILABLE", "NOT_FOUND"].includes(code);
    return Response.json({ error: safe ? code : "CHECKOUT_FAILED" }, { status: safe ? 400 : 403, headers });
  }
}
