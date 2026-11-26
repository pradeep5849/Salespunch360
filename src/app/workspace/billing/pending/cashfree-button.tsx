"use client";
import { useState, useRef, useEffect } from "react";
import Script from "next/script";

type CashfreeFactory = (options: { mode: "sandbox" }) => { checkout(options: { paymentSessionId: string; redirectTarget: "_self" }): Promise<{ error?: { message?: string } } | undefined> };
export default function CashfreeButton({ orderId, autoStart = false }: { orderId: string; autoStart?: boolean }) {
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
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
    } finally { setBusy(false); }
  }
  return <section aria-label="Online payment">
    <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onReady={() => { setReady(true); diagnostic("SDK_READY"); if(autoStart && !started.current && !sessionStorage.getItem("cashfree-start:"+orderId)){started.current=true;sessionStorage.setItem("cashfree-start:"+orderId,"1");void run("start");} }} onError={() => {diagnostic("SDK_ERROR");setMessage("Payment SDK could not load.");}}/>
    <p>Sandbox test payment — no real money is charged.</p>
    <button className="button-link" type="button" disabled={!ready || busy} onClick={() => void run("start")}>Pay Online – Cashfree</button>
    <button className="button-link" type="button" disabled={busy} onClick={() => void run("verify")}>Check payment status</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
