import { NextResponse } from "next/server";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { env } from "@/lib/env";
import { mutationGuard } from "@/lib/security/request";
import {
  beginGoogleBackup,
  GOOGLE_BACKUP_COOKIE,
} from "@/lib/account/google-drive-backup";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin)
    return new Response("Forbidden", { status: 403 });
  await mutationGuard("google-backup-connect", 10);
  const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    return new Response("Forbidden", { status: 403 });
  try {
    const start = beginGoogleBackup(actor.companyId, actor.id),
      response = NextResponse.json({ url: start.url });
    response.cookies.set(GOOGLE_BACKUP_COOKIE, start.cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/api/account/backup/google",
      maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Google Drive setup is unavailable. Check the server configuration.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
