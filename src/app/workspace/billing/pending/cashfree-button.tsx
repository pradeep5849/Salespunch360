"use client";
import { useState, useEffect } from "react";
import Script from "next/script";

type CashfreeFactory = (options: { mode: "sandbox" }) => { checkout(options: { paymentSessionId: string; redirectTarget: "_self" }): Promise<{ error?: { message?: string } } | undefined> };
export default function CashfreeButton({ orderId }: { orderId: string; autoStart?: boolean }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("paymentDocument")) {
      url.searchParams.set("paymentDocument","1");
      window.location.replace(url.href);
    }
  }, []);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"start" | "verify" | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const report = (event: string) => { void fetch("/api/billing/cashfree",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId,action:"diagnostic",event}),keepalive:true}).catch(()=>{}); };
    const seen = new Set<string>();
    const listener = (e: SecurityPolicyViolationEvent) => { const directive=e.effectiveDirective; const event=directive.startsWith("frame")?"CSP_FRAME":directive.startsWith("script")?"CSP_SCRIPT":directive.startsWith("connect")?"CSP_CONNECT":"CSP_OTHER"; if(!seen.has(event)){seen.add(event);report(event);} };
    document.addEventListener("securitypolicyviolation",listener);
    return ()=>document.removeEventListener("securitypolicyviolation",listener);
  },[orderId]);
  function diagnostic(event:string){void fetch("/api/billing/cashfree",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId,action:"diagnostic",event}),keepalive:true}).catch(()=>{});}
  async function run(action: "start" | "verify") {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch("/api/billing/cashfree", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "VALID_PHONE_REQUIRED" ? "Add a valid mobile number to your profile or company contact details before paying." : "Unable to complete checkout. Please try again.");
      if (action === "verify") {
        if (data.activated) { window.location.reload(); return; }
        setMessage(data.verified ? "Sandbox payment verified. Subscription activated." : "Payment has not been confirmed yet.");
      } else {
        const factory = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
        if (!factory || typeof data.paymentSessionId !== "string") throw new Error("Checkout is unavailable.");
        diagnostic("CHECKOUT_START");
        const result = await factory({ mode: "sandbox" }).checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
        diagnostic("CHECKOUT_RETURN");
        if (result?.error) throw new Error(result.error.message || "Cashfree checkout could not open.");
      }
    } catch (error) {
      if (action === "start") { diagnostic("CHECKOUT_ERROR"); sessionStorage.removeItem("cashfree-start:"+orderId); }
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
    } finally { setBusy(null); }
  }
  return <section aria-label="Online payment">
    <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onReady={() => { setReady(new URLSearchParams(window.location.search).has("paymentDocument")); diagnostic("SDK_READY");  }} onError={() => {diagnostic("SDK_ERROR");setMessage("Payment SDK could not load.");}}/>
    <p>Sandbox test payment — no real money is charged.</p>
    <button className="button-link" type="button" disabled={!ready || busy !== null} onClick={() => void run("start")}>{busy === "start" ? "Opening Cashfree…" : "Pay Now – Cashfree"}</button>
    <details><summary>Already completed payment?</summary><p>Use this only to recover a payment that has already been attempted.</p><button className="button-link" type="button" disabled={busy !== null} onClick={() => void run("verify")}>{busy === "verify" ? "Checking…" : "Check payment status"}</button></details>
    {message && <p role="status">{message}</p>}
  </section>;
}
