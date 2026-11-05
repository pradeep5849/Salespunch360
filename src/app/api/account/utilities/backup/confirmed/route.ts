import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { confirmManualBackupSaved } from "@/lib/account/backup-settings";
export async function POST(request: Request) {
  const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
  return Response.json(
    await confirmManualBackupSaved(actor, await request.json()),
  );
}
