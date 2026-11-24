"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";

let activeVerifier: RecaptchaVerifier | null = null;

function config() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (!projectId || !apiKey || !appId || !authDomain) {
    throw new Error("Firebase Web configuration is missing");
  }
  return { projectId, apiKey, appId, authDomain };
}

export async function sendFirebasePhoneCode(phone: string, containerId: string): Promise<ConfirmationResult> {
  const app = getApps().length ? getApp() : initializeApp(config());
  const auth = getAuth(app);
  // The widget is single-use across retry attempts; clear the old verifier first.
  activeVerifier?.clear();
  activeVerifier = null;
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Phone verification widget is unavailable");
  container.replaceChildren();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "normal" });
  activeVerifier = verifier;
  try {
    await verifier.render();
    return await signInWithPhoneNumber(auth, phone, verifier);
  } catch (error) {
    verifier.clear();
    activeVerifier = null;
    throw error;
  }
}

export async function confirmFirebasePhoneCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken(true);
}

export function clearFirebasePhoneVerifier() {
  activeVerifier?.clear();
  activeVerifier = null;
}
