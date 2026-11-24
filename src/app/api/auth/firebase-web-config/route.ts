import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.PHONE_VERIFICATION_ENABLED !== "true") {
    return NextResponse.json({ error: "NOT_ENABLED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_WEB_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_WEB_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN;
  if (!projectId || !apiKey || !appId || !authDomain) {
    return NextResponse.json({ error: "CONFIGURATION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ projectId, apiKey, appId, authDomain }, { headers: { "Cache-Control": "no-store" } });
}
