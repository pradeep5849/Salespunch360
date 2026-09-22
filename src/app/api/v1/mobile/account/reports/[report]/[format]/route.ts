import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAccountReportExport } from "@/lib/mobile/account-reports";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(
  r: Request,
  c: { params: Promise<{ report: string; format: string }> },
) {
  try {
    const p = await c.params,
      u = new URL(r.url),
      x = await mobileAccountReportExport(
        await authenticateMobileToken(r.headers.get("authorization")),
        p.report,
        p.format,
        Object.fromEntries(u.searchParams),
      );
    return new Response(x.bytes, {
      headers: {
        "Content-Type": x.mime,
        "Content-Disposition": `attachment; filename="${p.report}.${x.extension}"`,
      },
    });
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_REPORT_EXPORT", e)
    );
  }
}
