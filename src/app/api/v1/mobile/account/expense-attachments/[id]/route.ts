import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileExpenseDownload } from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    const x = await mobileExpenseDownload(
      await authenticateMobileToken(r.headers.get("authorization")),
      (await c.params).id,
    );
    return new Response(new Uint8Array(x.data), {
      headers: {
        "Content-Type": x.mimeType,
        "Content-Disposition": `attachment; filename="${x.name.replace(/["\\]/g, "_")}"`,
      },
    });
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_DOWNLOAD", e)
    );
  }
}
