import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountActor } from "@/lib/mobile/account-transactions";
import {
  mobileUnauthorized,
  mobileAuthorizationFailure,
} from "@/lib/mobile/http";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  prepareCompanyRestore,
  executeCompanyRestore,
} from "@/lib/account/company-restore";
import { readRestoreBody, restoreFailure } from "@/lib/account/restore-http";
import { requireCompanyRestoreOwner } from "@/lib/account/restore-owner";
export async function POST(request: Request) {
  try {
    const actor = mobileAccountActor(
      await authenticateMobileToken(request.headers.get("authorization")),
    );
    await requireCompanyRestoreOwner(actor);
    await assertOperationalWrite(actor.companyId);
    const preview = new URL(request.url).searchParams.get("mode") === "preview";
    const bytes = await readRestoreBody(
      request,
      preview ? 128 * 1024 * 1024 : 16384,
    );
    return Response.json(
      preview
        ? await prepareCompanyRestore(actor, bytes)
        : await executeCompanyRestore(
            actor,
            JSON.parse(new TextDecoder().decode(bytes)),
          ),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      restoreFailure(error)
    );
  }
}
