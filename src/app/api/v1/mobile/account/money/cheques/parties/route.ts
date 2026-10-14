import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileChequeParties } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(request: Request) {
  try {
    return mobileJson(
      await mobileChequeParties(
        await authenticateMobileToken(request.headers.get("authorization")),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_CHEQUE_PARTIES", error)
    );
  }
}
