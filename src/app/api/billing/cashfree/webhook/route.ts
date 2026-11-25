import { db } from "@/lib/db";
import { verifySandboxWebhook } from "@/lib/billing/cashfree-sandbox";
import { verifyCashfreeSandboxPayment } from "@/lib/billing/cashfree-verification";
import { activateVerifiedPayment } from "@/lib/billing/service";
import { z } from "zod";
const eventSchema = z.object({ type: z.string(), data: z.object({ order: z.object({ order_id: z.string().uuid() }) }) });
export async function POST(request: Request) {
  if (process.env.CASHFREE_ENV !== "sandbox") return new Response(null,{status:404});
  try {
    const raw = await request.text();
    if (raw.length > 65536) return new Response(null,{status:413});
    if (!verifySandboxWebhook(raw,request.headers.get("x-webhook-timestamp") ?? "",request.headers.get("x-webhook-signature") ?? "")) return new Response(null,{status:401});
    const event = eventSchema.safeParse(JSON.parse(raw));
    if (!event.success) return new Response(null,{status:400});
    if (event.data.type !== "PAYMENT_SUCCESS_WEBHOOK") return new Response(null,{status:200});
    const order = await db.billingOrder.findUnique({where:{id:event.data.data.order.order_id}});
    if (!order) return new Response(null,{status:404});
    const verified = await verifyCashfreeSandboxPayment(order);
    if (!verified) return new Response(null,{status:503});
    await activateVerifiedPayment(verified);
    return new Response(null,{status:200});
  } catch {
    return new Response(null,{status:503});
  }
}
