import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileExport } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ type: string; format: string }> },
) {
  try {
    const p = await params,
      x = await mobileExport(
        await authenticateMobileToken(r.headers.get("authorization")),
        p.type,
        p.format,
      );
    return new Response(x.bytes, {
      headers: {
        "content-type": x.contentType,
        "content-disposition": `attachment; filename="${p.type}.${p.format}"`,
      },
    });
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_EXPORT", e)
    );
  }
}
