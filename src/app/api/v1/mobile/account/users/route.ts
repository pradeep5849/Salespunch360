import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAccountUsers,
  mobileAccountUserSave,
} from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
const fail = (e: unknown) =>
  mobileUnauthorized(e) ??
  mobileAuthorizationFailure(e) ??
  mobileUnexpected("MOBILE_ACCOUNT_USERS", e);
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileAccountUsers(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileAccountUserSave(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(r: Request) {
  try {
    return mobileJson(
      await mobileAccountUserSave(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
        true,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
