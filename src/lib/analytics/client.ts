"use client";
import {
  CONSENT_COOKIE,
  GA4_MEASUREMENT_ID,
  SITE_ORIGIN,
  parseConsent,
  safePageLocation,
  type TrackingConsent,
} from "./policy";

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {
  gtag?: Gtag;
  dataLayer?: unknown[];
  __sp360GaReady?: boolean;
  [key: `ga-disable-${string}`]: boolean | undefined;
};
export function browserConsent(): TrackingConsent {
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (privacy.globalPrivacyControl || navigator.doNotTrack === "1")
    return { analytics: false, advertising: false };
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(CONSENT_COOKIE + "="));
  return parseConsent(entry?.slice(CONSENT_COOKIE.length + 1));
}
export function browserAnalyticsAllowed() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" &&
    window.location.origin === SITE_ORIGIN &&
    browserConsent().analytics
  );
}
export function analyticsWindow() {
  return window as unknown as AnalyticsWindow;
}
export async function claimAndSend(
  eventName: "sign_up" | "login" | "begin_checkout" | "purchase",
  orderId?: string,
) {
  const target = analyticsWindow();
  if (!browserAnalyticsAllowed() || !target.__sp360GaReady || !target.gtag)
    return;
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, ...(orderId ? { orderId } : {}) }),
      keepalive: true,
    });
    if (response.status !== 200 || !browserAnalyticsAllowed()) return;
    const result = await response.json();
    if (
      result.eventName !== eventName ||
      !result.params ||
      typeof result.params !== "object"
    )
      return;
    target.gtag("event", eventName, {
      ...result.params,
      send_to: GA4_MEASUREMENT_ID,
      page_title: "SalesPunch360",
      page_referrer: "",
      page_location: safePageLocation(
        window.location.href,
        browserConsent().advertising,
      ),
    });
  } catch {
    /* Optional analytics must not block checkout or navigation. */
  }
}
export function captureCheckout(orderId: string) {
  void claimAndSend("begin_checkout", orderId);
}

export function trackFunnel(
  eventName: "view_item" | "add_to_cart",
  value?: number,
) {
  const target = analyticsWindow();
  if (!browserAnalyticsAllowed() || !target.__sp360GaReady) return;
  target.gtag?.("event", eventName, {
    send_to: GA4_MEASUREMENT_ID,
    currency: "INR",
    ...(Number.isFinite(value) && Number(value) > 0 ? { value } : {}),
    items: [
      { item_id: "subscription", item_name: "SalesPunch360 subscription" },
    ],
    page_location: safePageLocation(
      window.location.href,
      browserConsent().advertising,
    ),
    page_title: "SalesPunch360",
    page_referrer: "",
  });
}
