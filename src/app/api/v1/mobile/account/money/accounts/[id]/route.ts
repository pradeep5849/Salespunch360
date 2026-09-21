import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileDisableMoneyAccount,
  mobileUpdateMoneyAccount,
} from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function PATCH(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileUpdateMoneyAccount(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_MONEY_ACCOUNT_UPDATE", e)
    );
  }
}
export async function DELETE(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileDisableMoneyAccount(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_MONEY_ACCOUNT_DISABLE", e)
    );
  }
}
