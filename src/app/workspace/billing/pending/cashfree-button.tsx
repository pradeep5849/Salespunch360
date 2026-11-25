"use client";
import { useState } from "react";
import Script from "next/script";

type CashfreeFactory = (options: { mode: "sandbox" }) => { checkout(options: { paymentSessionId: string; redirectTarget: "_self" }): Promise<unknown> };
export default function CashfreeButton({ orderId }: { orderId: string }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: "start" | "verify") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/cashfree", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "VALID_PHONE_REQUIRED" ? "Please update your mobile number before paying." : "Unable to complete checkout. Please try again.");
      if (action === "verify") {
        if (data.activated) { window.location.reload(); return; }
        setMessage(data.verified ? "Sandbox payment verified. Subscription activated." : "Payment has not been confirmed yet.");
      } else {
        const factory = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
        if (!factory || typeof data.paymentSessionId !== "string") throw new Error("Checkout is unavailable.");
        await factory({ mode: "sandbox" }).checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
    } finally { setBusy(false); }
  }
  return <section aria-label="Online payment">
    <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onReady={() => setReady(true)} onError={() => setMessage("Payment SDK could not load.")}/>
    <p>Sandbox test payment — no real money is charged.</p>
    <button type="button" disabled={!ready || busy} onClick={() => void run("start")}>Pay Online – Cashfree</button>
    <button type="button" disabled={busy} onClick={() => void run("verify")}>Check payment status</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
