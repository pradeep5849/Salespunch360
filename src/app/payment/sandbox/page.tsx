"use client";
import Script from "next/script";
import { useState } from "react";
export default function SandboxCheckoutPage() {
  const [ready,setReady]=useState(false);
  const [message,setMessage]=useState("");
  async function pay() {
    const session=new URLSearchParams(window.location.hash.slice(1)).get("session");
    if (!session || session.length>2048) {setMessage("Invalid payment session.");return;}
    const factory=(window as unknown as {Cashfree?: (options:{mode:"sandbox"})=>{checkout(options:{paymentSessionId:string;redirectTarget:"_self"}):Promise<unknown>}}).Cashfree;
    if (!factory) return;
    try {await factory({mode:"sandbox"}).checkout({paymentSessionId:session,redirectTarget:"_self"});}
    catch {setMessage("Checkout could not open. Return to the app and retry.");}
  }
  return <main><h1>SalesPunch360 test payment</h1><p>Sandbox only. No real money is charged.</p><Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onReady={()=>setReady(true)} onError={()=>setMessage("Payment SDK unavailable.")}/><button disabled={!ready} onClick={()=>void pay()}>Continue to Cashfree</button><p role="status">{message}</p><p>After payment, return to the app and check payment status.</p></main>;
}
