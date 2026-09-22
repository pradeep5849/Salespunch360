import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileJournalDetail } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileJournalDetail(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_JOURNAL_DETAIL", e)
    );
  }
}
