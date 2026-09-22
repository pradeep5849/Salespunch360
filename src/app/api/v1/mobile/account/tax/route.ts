import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileSaveTax, mobileTax } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const q = Object.fromEntries(new URL(r.url).searchParams);
    return mobileJson(
      await mobileTax(
        await authenticateMobileToken(r.headers.get("authorization")),
        q.from && q.to ? q : undefined,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_TAX", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileSaveTax(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_TAX_SAVE", e)
    );
  }
}
