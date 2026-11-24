"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendFirebasePhoneCode, confirmFirebasePhoneCode, clearFirebasePhoneVerifier } from "@/lib/auth/firebase-web-client";
import type { ConfirmationResult } from "firebase/auth";

export function VerifyMobileForm({ initialPhone }: { initialPhone: string }) {
  const router = useRouter();
  const phone = initialPhone;
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  useEffect(() => () => clearFirebasePhoneVerifier(), []);
  async function send() {
    setBusy(true); setError("");
    try {
      const reserve = await fetch("/api/auth/phone-otp/reserve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!reserve.ok) throw new Error(reserve.status === 429 ? "SMS limit reached. Try again later." : "Unable to request OTP.");
      setConfirmation(await sendFirebasePhoneCode(phone, "first-use-recaptcha"));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send OTP."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!confirmation) return;
    setBusy(true); setError("");
    try {
      const idToken = await confirmFirebasePhoneCode(confirmation, code);
      const response = await fetch("/api/auth/phone-otp/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, idToken }),
      });
      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to confirm phone number.");
      }
      setVerified(true);
      router.replace("/workspace");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid or expired OTP."); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label htmlFor="verify-phone">Mobile number (international format)</label>
      <input id="verify-phone" type="tel" inputMode="tel" autoComplete="tel" required
        value={phone} readOnly aria-readonly="true" placeholder="+919876543210" />
      {!confirmation && !verified && <button type="button" disabled={busy || !/^\+[1-9]\d{1,14}$/.test(phone)} onClick={send}>
        {busy ? "Please wait…" : "Send OTP"}
      </button>}
      <div id="first-use-recaptcha" />
      {confirmation && !verified && <>
        <label htmlFor="verify-code">6-digit SMS code</label>
        <input id="verify-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <button type="button" disabled={busy || code.length !== 6} onClick={confirm}>Verify OTP</button>
        <button type="button" disabled={busy} onClick={() => { clearFirebasePhoneVerifier(); setConfirmation(null); setCode(""); setError(""); }}>Resend OTP</button>
      </>}
      {verified && <p role="status">Mobile number verified. Redirecting…</p>}
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
