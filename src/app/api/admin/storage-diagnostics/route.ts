import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { FirebaseStorage } from "@/lib/storage/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only diagnostics for the platform super administrator.
 * Never return bucket names, credentials, exception messages, or object keys.
 * Deliberately not a write probe: successful metadata access alone does not
 * prove upload permission.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN" || user.companyId !== null) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const configured = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_STORAGE_BUCKET"].every(
    (name) => Boolean(process.env[name]?.trim()),
  );
  const driver = process.env.STORAGE_DRIVER ?? "hostinger";
  if (driver !== "firebase" || !configured) {
    return NextResponse.json({
      driver: driver === "firebase" ? "firebase" : "other",
      configured,
      ok: false,
      category: driver !== "firebase" ? "FIREBASE_NOT_SELECTED" : "CONFIGURATION_MISSING",
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const result = await new FirebaseStorage().diagnose();
  return NextResponse.json(
    { driver: "firebase", configured: true, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
