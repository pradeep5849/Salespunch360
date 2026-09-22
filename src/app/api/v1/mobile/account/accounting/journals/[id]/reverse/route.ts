import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileReverseJournal } from "@/lib/mobile/account-accounting";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    const d = await r.json();
    return mobileJson(
      await mobileReverseJournal(
        await authenticateMobileToken(r.headers.get("authorization")),
        { ...d, journalEntryId: (await c.params).id },
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_JOURNAL_REVERSE", e)
    );
  }
}
