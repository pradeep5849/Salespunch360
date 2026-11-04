import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { env } from "@/lib/env";
import {
  finishGoogleBackup,
  validateGoogleBackupState,
  GOOGLE_BACKUP_COOKIE,
} from "@/lib/account/google-drive-backup";
export async function GET(request: Request) {
  const jar = await cookies(),
    cookie = jar.get(GOOGLE_BACKUP_COOKIE)?.value;
  // Consume before exchange, including cancellation and failures. No provider error or code is reflected.
  jar.set(GOOGLE_BACKUP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/api/account/backup/google",
    maxAge: 0,
  });
  let result = "failed";
  try {
    const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS"),
      query = new URL(request.url).searchParams;
    if (
      !actor.companyId ||
      actor.accountRole !== "ACCOUNT_ADMIN" ||
      !cookie ||
      !query.get("state")
    )
      throw new Error();
    const state = validateGoogleBackupState(
      cookie,
      query.get("state")!,
      actor.companyId,
      actor.id,
    );
    if (query.has("error")) result = "cancelled";
    else {
      const code = query.get("code");
      if (!code || code.length > 4096) throw new Error();
      await finishGoogleBackup(code, state);
      result = "connected";
    }
  } catch {
    /* No credentials, codes or provider response bodies in logs or redirects. */
  }
  const response = NextResponse.redirect(
    new URL(`/workspace/account/settings/backup?google=${result}`, env.APP_URL),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
