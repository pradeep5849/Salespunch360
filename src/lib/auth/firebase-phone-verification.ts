import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const APP_NAME = "salespunch360-phone-verification";
const MAX_AUTH_AGE_SECONDS = 10 * 60;

function phoneAuthApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("PHONE_VERIFICATION_NOT_CONFIGURED");
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  }, APP_NAME);
}

/**
 * Server-side proof of a *recent* Firebase SMS verification.
 * A client-supplied phone number or boolean flag is never proof of verification.
 * Callers must additionally atomically bind the UID/phone to a single account,
 * and prevent reusing the same verification proof for another registration.
 */
export async function verifyFirebasePhoneProof(idToken: string, expectedPhone: string) {
  if (!/^\\+[1-9]\\d{1,14}$/.test(expectedPhone)) {
    throw new Error("INVALID_PHONE_NUMBER");
  }
  if (!idToken || idToken.length > 8192) {
    throw new Error("INVALID_PHONE_PROOF");
  }

  let decoded;
  try {
    decoded = await getAuth(phoneAuthApp()).verifyIdToken(idToken, true);
  } catch {
    throw new Error("INVALID_PHONE_PROOF");
  }

  const now = Math.floor(Date.now() / 1000);
  const authTime = decoded.auth_time;
  if (
    decoded.phone_number !== expectedPhone ||
    decoded.firebase?.sign_in_provider !== "phone" ||
    typeof authTime !== "number" ||
    authTime > now + 60 ||
    now - authTime > MAX_AUTH_AGE_SECONDS
  ) {
    throw new Error("INVALID_PHONE_PROOF");
  }

  return { firebaseUid: decoded.uid, phoneNumber: expectedPhone, verifiedAt: new Date() };
}
