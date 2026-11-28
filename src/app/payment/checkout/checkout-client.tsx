"use client";
import Script from "next/script";
import { useState, useEffect, useRef, useCallback } from "react";
export default function CashfreeCheckoutPage({
  environment,
}: {
  environment: "sandbox" | "production";
}) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const launched = useRef(false);
  const pay = useCallback(async () => {
    const session = new URLSearchParams(window.location.hash.slice(1)).get(
      "session",
    );
    if (!session || session.length > 2048) {
      setMessage("Invalid payment session.");
      return;
    }
    const factory = (
      window as unknown as {
        Cashfree?: (options: { mode: "sandbox" | "production" }) => {
          checkout(options: {
            paymentSessionId: string;
            redirectTarget: "_self";
          }): Promise<unknown>;
        };
      }
    ).Cashfree;
    if (!factory) return;
    try {
      await factory({ mode: environment }).checkout({
        paymentSessionId: session,
        redirectTarget: "_self",
      });
    } catch {
      setMessage("Checkout could not open. Return to the app and retry.");
    }
  }, [environment]);
  useEffect(() => {
    if (ready && !launched.current) {
      launched.current = true;
      void pay();
    }
  }, [ready, pay]);
  return (
    <main>
      <h1>SalesPunch360 payment</h1>
      {environment === "sandbox" && (
        <p>Sandbox only. No real money is charged.</p>
      )}
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        onReady={() => setReady(true)}
        onError={() => setMessage("Payment SDK unavailable.")}
      />
      <button disabled={!ready} onClick={() => void pay()}>
        Retry opening Cashfree
      </button>
      <p role="status">{message}</p>
      <p>After payment, return to the app for automatic verification.</p>
    </main>
  );
}
