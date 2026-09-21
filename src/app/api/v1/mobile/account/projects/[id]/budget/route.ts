import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileProjectBudget } from "@/lib/mobile/account-projects";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function PUT(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    return mobileJson(
      await mobileProjectBudget(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_PROJECT_BUDGET", e)
    );
  }
}
