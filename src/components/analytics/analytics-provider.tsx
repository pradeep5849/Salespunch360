"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  analyticsWindow,
  browserAnalyticsAllowed,
  browserConsent,
  claimAndSend,
  trackFunnel,
} from "@/lib/analytics/client";
import {
  CONSENT_COOKIE,
  DENIED_CONSENT,
  GA4_MEASUREMENT_ID,
  SITE_ORIGIN,
  consentValue,
  safePageLocation,
  type TrackingConsent,
} from "@/lib/analytics/policy";
import "./analytics.css";

function applyConsent(consent: TrackingConsent) {
  const target = analyticsWindow();
  target[`ga-disable-${GA4_MEASUREMENT_ID}`] = !consent.analytics;
  target.gtag?.("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.advertising ? "granted" : "denied",
    ad_user_data: consent.advertising ? "granted" : "denied",
    ad_personalization: "denied",
  });
}
function clearAnalyticsCookies() {
  for (const item of document.cookie.split(";")) {
    const name = item.trim().split("=")[0];
    if (!/^(_ga(?:_|$)|_gid$|_gat|_gcl_)/.test(name)) continue;
    for (const domain of [
      "",
      "; Domain=www.salespunch360.com",
      "; Domain=.salespunch360.com",
    ]) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
    }
  }
}
export function AnalyticsProvider() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [enabledHost, setEnabledHost] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(false);
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<TrackingConsent>(DENIED_CONSENT);
  const lastPage = useRef<string | null>(null);
  const signupChecked = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" ||
      window.location.origin !== SITE_ORIGIN
    )
      return;
    const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
    const current = browserConsent();
    const timer = window.setTimeout(() => {
      setEnabledHost(true);
      setPrivacySignal(
        !!privacy.globalPrivacyControl || navigator.doNotTrack === "1",
      );
      setConsent(current);
      setVisible(
        !document.cookie
          .split(";")
          .some((value) => value.trim().startsWith(CONSENT_COOKIE + "=")),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" ||
      window.location.origin !== SITE_ORIGIN
    )
      return;
    const target = analyticsWindow();
    if (!consent.analytics || !browserConsent().analytics) {
      applyConsent(DENIED_CONSENT);
      clearAnalyticsCookies();
      return;
    }
    if (!target.gtag) {
      target.dataLayer = target.dataLayer ?? [];
      target.gtag = function () {
        // Google's command queue uses the canonical Arguments object, not an event object.
        // eslint-disable-next-line prefer-rest-params
        target.dataLayer!.push(arguments);
      };
      target.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      target.gtag("set", "ads_data_redaction", true);
      target.gtag("set", "url_passthrough", false);
      applyConsent(consent);
      target.gtag("js", new Date());
      target.gtag("config", GA4_MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_title: "SalesPunch360",
        page_referrer: "",
        page_location: safePageLocation(
          window.location.href,
          consent.advertising,
        ),
      });
    }
    applyConsent(consent);
    if (target.__sp360GaReady) {
      const timer = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(timer);
    }
    let script = document.getElementById(
      "sp360-ga4",
    ) as HTMLScriptElement | null;
    const loaded = () => {
      target.__sp360GaReady = true;
      setReady(true);
    };
    if (!script) {
      script = document.createElement("script");
      script.id = "sp360-ga4";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
      script.addEventListener("load", loaded, { once: true });
      document.head.appendChild(script);
    } else script.addEventListener("load", loaded, { once: true });
    return () => script?.removeEventListener("load", loaded);
  }, [consent]);
  useEffect(() => {
    if (pathname === "/register") signupChecked.current = false;
    if (!ready || !browserAnalyticsAllowed()) return;
    const page = safePageLocation(
      window.location.href,
      browserConsent().advertising,
    );
    if (lastPage.current !== pathname) {
      lastPage.current = pathname;
      if (
        pathname === "/pricing" ||
        pathname?.startsWith("/workspace/billing/checkout")
      )
        trackFunnel("view_item");
      analyticsWindow().gtag?.("set", {
        page_location: page,
        page_title: "SalesPunch360",
        page_referrer: "",
      });
      analyticsWindow().gtag?.("event", "page_view", {
        send_to: GA4_MEASUREMENT_ID,
        page_location: page,
        page_title: "SalesPunch360",
        page_referrer: "",
      });
    }
    if (!signupChecked.current && pathname?.startsWith("/workspace")) {
      signupChecked.current = true;
      void claimAndSend("sign_up");
      void claimAndSend("login");
    }
    window.dispatchEvent(new Event("sp360-analytics-ready"));
  }, [pathname, ready, consent]);
  function choose(value: TrackingConsent) {
    document.cookie = `${CONSENT_COOKIE}=${consentValue(value)}; Path=/; Max-Age=15552000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    setConsent(value);
    setVisible(false);
    if (!value.analytics) {
      applyConsent(DENIED_CONSENT);
      clearAnalyticsCookies();
      lastPage.current = null;
    }
  }
  if (!enabledHost) return null;
  return (
    <>
      <button
        type="button"
        className="analytics-privacy-button"
        onClick={() => setVisible(true)}
      >
        Privacy choices
      </button>
      {visible && (
        <aside
          className="analytics-consent"
          aria-label="Optional analytics and advertising measurement"
        >
          <p>Choose optional measurement</p>
          <span>
            With permission, Google Analytics helps us understand site usage.
            Advertising measurement helps us measure subscription campaigns.
            Customer records, names, phone numbers and emails are not sent.
            Advertising personalization stays off.
          </span>
          {privacySignal && (
            <p>Your browser privacy setting keeps optional tracking off.</p>
          )}
          <a href="/privacy">Privacy policy</a>
          <div>
            <button type="button" onClick={() => choose(DENIED_CONSENT)}>
              Reject optional
            </button>
            <button
              type="button"
              disabled={privacySignal}
              onClick={() => choose({ analytics: true, advertising: false })}
            >
              Analytics only
            </button>
            <button
              type="button"
              disabled={privacySignal}
              onClick={() => choose({ analytics: true, advertising: true })}
            >
              Analytics and advertising measurement
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
