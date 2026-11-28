import { db } from "@/lib/db";
import { verifyCashfreeWebhook } from "@/lib/billing/cashfree-client";
import { cashfreeAvailable } from "@/lib/billing/cashfree-config";
import { verifyCashfreePayment } from "@/lib/billing/cashfree-verification";
import { activateVerifiedPayment } from "@/lib/billing/service";
import { z } from "zod";
const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    order: z.object({ order_id: z.string().uuid() }),
    payment: z.unknown().optional(),
  }),
});
export async function POST(request: Request) {
  if (!cashfreeAvailable()) return new Response(null, { status: 503 });
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 65536)
      return new Response(null, { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65536)
      return new Response(null, { status: 413 });
    if (
      !verifyCashfreeWebhook(
        raw,
        request.headers.get("x-webhook-timestamp") ?? "",
        request.headers.get("x-webhook-signature") ?? "",
      )
    )
      return new Response(null, { status: 401 });
    const event = eventSchema.safeParse(JSON.parse(raw));
    if (!event.success) return new Response(null, { status: 400 });
    if (event.data.type !== "PAYMENT_SUCCESS_WEBHOOK")
      return new Response(null, { status: 200 });
    const checkedPayment = z
      .object({
        cf_payment_id: z.union([z.string(), z.number()]),
        payment_amount: z.number(),
        payment_currency: z.literal("INR"),
        payment_status: z.literal("SUCCESS"),
      })
      .safeParse(event.data.data.payment);
    if (!checkedPayment.success) return new Response(null, { status: 400 });
    const payment = checkedPayment.data;
    const order = await db.billingOrder.findUnique({
      where: { id: event.data.data.order.order_id },
    });
    if (!order) return new Response(null, { status: 404 });
    const verified = await verifyCashfreePayment(order);
    if (!verified) return new Response(null, { status: 503 });
    if (
      String(payment.cf_payment_id) !==
        verified.providerPaymentId.replace(/^cashfree_(sandbox|live)_/, "") ||
      !Number.isFinite(payment.payment_amount) ||
      Math.abs(
        payment.payment_amount * 100 - Math.round(payment.payment_amount * 100),
      ) > 0.000001 ||
      payment.payment_amount.toFixed(2) !== verified.amount
    )
      return new Response(null, { status: 400 });
    await activateVerifiedPayment(verified);
    return new Response(null, { status: 200 });
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof Error &&
        error.message === "PAYMENT_ENVIRONMENT_MISMATCH"
          ? 409
          : 503,
    });
  }
}
