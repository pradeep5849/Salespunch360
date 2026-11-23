import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { FirebaseStorage } from "@/lib/storage/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const denied = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "SUPER_ADMIN" || user.companyId !== null) return denied();
  const token = process.env.CHECKIN_MIGRATION_TOKEN;
  if (process.env.CHECKIN_MIGRATION_ENABLED !== "true" || !token || token.length < 32) return denied();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(a, b)) return denied();
  const result = await new FirebaseStorage().diagnose();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
