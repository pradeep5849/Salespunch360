"use client";

import { useEffect } from "react";

function isNativeAndroidWebView() {
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && (/; wv\)/i.test(ua) || /\bVersion\/\d+(?:\.\d+)* Chrome\//i.test(ua));
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || isNativeAndroidWebView()) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
