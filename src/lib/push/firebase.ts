import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";

let app: App | null | undefined;
export const normalizeFirebasePrivateKey = (value: string) => value.replace(/\\n/g, "\n").trim();
export function firebaseApp(): App | null {
  if (app !== undefined) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    : undefined;
  if (!projectId || !clientEmail || !privateKey) return (app = null);
  app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}
export async function sendFcm(message: Message) {
  const configured = firebaseApp();
  if (!configured) return null;
  return getMessaging(configured).send(message);
}
export function isInvalidFcmToken(error: unknown) {
  const code = (error as { code?: string })?.code;
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
export function resetFirebaseForTests() {
  app = undefined;
}
