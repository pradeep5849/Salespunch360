import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileJournal,
  mobileJournalHistory,
} from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileJournal(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNTING_WRITE", e)
    );
  }
}

export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileJournalHistory(
        await authenticateMobileToken(r.headers.get("authorization")),
        Object.fromEntries(new URL(r.url).searchParams),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNTING_READ", e)
    );
  }
}
