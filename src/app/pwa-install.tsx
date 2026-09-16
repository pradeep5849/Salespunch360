"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

const DISMISS_KEY = "sp360-pwa-install-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isNativeAndroidWebView() {
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && (/; wv\)/i.test(ua) || /\bVersion\/\d+(?:\.\d+)* Chrome\//i.test(ua));
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export function shouldRegisterPwaServiceWorker() {
  return !isNativeAndroidWebView() && !isStandalone();
}

export function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || isNativeAndroidWebView()) return;
    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
    if (!wasDismissed && isIosSafari()) setShowIosHelp(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (!wasDismissed) setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setShowIosHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || (!promptEvent && !showIosHelp)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setPromptEvent(null);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  };

  return (
    <aside className="pwa-install" role="region" aria-label="Install SalesPunch360">
      <div>
        <strong>Install SalesPunch360</strong>
        <span>{showIosHelp ? "In Safari, tap Share, then Add to Home Screen." : "Add SalesPunch360 to your home screen for faster access."}</span>
      </div>
      <div className="pwa-install-actions">
        {promptEvent ? <button type="button" onClick={install}>Install</button> : null}
        <button type="button" className="pwa-install-later" onClick={dismiss}>Not now</button>
      </div>
    </aside>
  );
}
