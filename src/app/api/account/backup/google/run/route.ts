import { NextResponse } from "next/server";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { env } from "@/lib/env";
import { mutationGuard } from "@/lib/security/request";
import { runGoogleDriveBackup } from "@/lib/account/backup-settings";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin)
    return new Response("Forbidden", { status: 403 });
  await mutationGuard("google-backup-run", 3);
  const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    return new Response("Forbidden", { status: 403 });
  let result = "backup-failed";
  try {
    const uploaded = await runGoogleDriveBackup(
      { ...actor, companyId: actor.companyId },
      new Date(),
      true,
    );
    result = uploaded ? "uploaded" : "in-progress";
  } catch {
    /* Never expose provider tokens or company snapshot details. */
  }
  return NextResponse.redirect(
    new URL(`/workspace/account/settings/backup?google=${result}`, env.APP_URL),
    303,
  );
}
