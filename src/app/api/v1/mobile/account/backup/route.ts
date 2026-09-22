import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileBackup } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const x = await mobileBackup(
      await authenticateMobileToken(r.headers.get("authorization")),
    );
    return new Response(x.bytes, {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${x.fileName}"`,
      },
    });
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_BACKUP", e)
    );
  }
}
