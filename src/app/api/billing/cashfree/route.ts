import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { startCashfreeCheckout, inspectCashfreeCheckout } from "@/lib/billing/cashfree-checkout";
import { z } from "zod";

const schema = z.object({ orderId: z.string().uuid(), action: z.enum(["start", "verify", "diagnostic"]), event: z.enum(["SDK_READY","SDK_ERROR","CHECKOUT_START","CHECKOUT_RETURN","CHECKOUT_ERROR","CSP_FRAME","CSP_SCRIPT","CSP_CONNECT","CSP_OTHER"]).optional() });
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
    if (parsed.data.action === "diagnostic") {
      if (!parsed.data.event) return Response.json({error:"INVALID_REQUEST"},{status:400,headers});
      console.info(JSON.stringify({category:"CASHFREE_BROWSER",event:parsed.data.event}));
      return Response.json({ok:true},{headers});
    }
    const result = parsed.data.action === "start"
      ? await startCashfreeCheckout(identity, parsed.data.orderId)
      : await inspectCashfreeCheckout(identity, parsed.data.orderId);
    console.info(JSON.stringify({category:"CASHFREE_API",action:parsed.data.action,status:"OK"}));
    return Response.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    console.warn(JSON.stringify({category:"CASHFREE_API",status:"FAILED",code:/^(CASHFREE_REQUEST_FAILED_\d{3}|VALID_PHONE_REQUIRED|ORDER_NOT_PAYABLE|CASHFREE_SANDBOX_UNAVAILABLE|INVALID_CASHFREE_RESPONSE|NOT_FOUND)$/.test(code)?code:"CHECKOUT_FAILED"}));
    const safe = ["ORDER_NOT_PAYABLE", "VALID_PHONE_REQUIRED", "CASHFREE_SANDBOX_UNAVAILABLE", "NOT_FOUND"].includes(code);
    return Response.json({ error: safe ? code : "CHECKOUT_FAILED" }, { status: safe ? 400 : 403, headers });
  }
}
