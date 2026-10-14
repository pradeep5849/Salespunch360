import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileOwnerHistory } from "@/lib/mobile/account-money";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileOwnerHistory(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        Object.fromEntries(new URL(r.url).searchParams),
      ),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_DATE_RANGE")
      return mobileJson(
        { error: "Enter valid dates with From before To." },
        400,
      );
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_OWNER_HISTORY", e)
    );
  }
}
