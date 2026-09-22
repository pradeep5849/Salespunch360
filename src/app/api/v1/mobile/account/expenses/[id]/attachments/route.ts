import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileExpenseUpload } from "@/lib/mobile/account-expenses";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  try {
    const f = (await r.formData()).get("file");
    if (!(f instanceof File))
      return mobileJson({ error: "INVALID_INPUT" }, 400);
    return mobileJson(
      await mobileExpenseUpload(
        await authenticateMobileToken(r.headers.get("authorization")),
        (await c.params).id,
        f,
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_EXPENSE_ATTACHMENT", e)
    );
  }
}
