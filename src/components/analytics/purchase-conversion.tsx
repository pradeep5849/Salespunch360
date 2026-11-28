"use client";
import { useEffect } from "react";
import { claimAndSend } from "@/lib/analytics/client";
export function PurchaseConversion({ orderId }: { orderId: string }) {
  useEffect(() => {
    const send = () => {
      void claimAndSend("purchase", orderId);
    };
    send();
    window.addEventListener("sp360-analytics-ready", send);
    return () => window.removeEventListener("sp360-analytics-ready", send);
  }, [orderId]);
  return null;
}
