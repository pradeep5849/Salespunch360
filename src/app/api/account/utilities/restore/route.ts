import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { mutationGuard } from "@/lib/security/request";
import {
  prepareCompanyRestore,
  executeCompanyRestore,
} from "@/lib/account/company-restore";
import { readRestoreBody, restoreFailure } from "@/lib/account/restore-http";
import { requireCompanyRestoreOwner } from "@/lib/account/restore-owner";
export async function POST(request: Request) {
  try {
    await mutationGuard("company-restore", 5);
    const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
    await requireCompanyRestoreOwner(actor as never);
    const preview = new URL(request.url).searchParams.get("mode") === "preview";
    const contentType = request.headers.get("content-type")?.split(";")[0];
    if (
      contentType !==
      (preview ? "application/octet-stream" : "application/json")
    )
      throw new Error("RESTORE_INVALID_FILE");
    const bytes = await readRestoreBody(
      request,
      preview ? 128 * 1024 * 1024 : 16384,
    );
    const result = preview
      ? await prepareCompanyRestore(actor as never, bytes)
      : await executeCompanyRestore(
          actor as never,
          JSON.parse(new TextDecoder().decode(bytes)),
        );
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return restoreFailure(error);
  }
}
