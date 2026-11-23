"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";

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
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "normal" });
  try {
    await verifier.render();
    return await signInWithPhoneNumber(auth, phone, verifier);
  } catch (error) {
    verifier.clear();
    throw error;
  }
}

export async function confirmFirebasePhoneCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken(true);
}
