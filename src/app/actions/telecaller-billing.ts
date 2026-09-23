"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mutationGuard } from "@/lib/security/request";
import { confirmTelecallerManualPayment, createTelecallerBillingOrder } from "@/lib/billing/telecaller";

export async function createTelecallerOrderAction(form: FormData) {
  await mutationGuard("telecaller-billing-order", 10);
  const addedSeats = Number(form.get("addedSeats") ?? 0);
  const billingPeriod = String(form.get("billingPeriod") ?? "YEARLY");
  if (billingPeriod !== "SIX_MONTH" && billingPeriod !== "YEARLY") redirect("/workspace/billing/telecaller?error=INVALID_BILLING_PERIOD");
  let orderId = "";
  try {
    const order = await createTelecallerBillingOrder({ addedSeats, billingPeriod });
    orderId = order.id;
  } catch (error) {
    const code = error instanceof Error ? error.message : "ORDER_CREATE_FAILED";
    redirect(`/workspace/billing/telecaller?error=${encodeURIComponent(code)}`);
  }
  revalidatePath("/workspace/billing/telecaller");
  redirect(`/workspace/billing/telecaller?order=${orderId}`);
}

export async function confirmTelecallerPaymentAction(form: FormData) {
  await mutationGuard("telecaller-payment-confirm", 10);
  const orderId = String(form.get("orderId") ?? "");
  const reference = String(form.get("reference") ?? "");
  await confirmTelecallerManualPayment(orderId, reference);
  revalidatePath("/admin/billing/telecaller-orders");
  revalidatePath("/workspace/billing/telecaller");
  revalidatePath("/workspace/employees");
}