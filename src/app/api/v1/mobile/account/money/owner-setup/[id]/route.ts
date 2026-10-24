import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileUpdateOwnerIdentity } from "@/lib/mobile/account-money";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return mobileJson(
      await mobileUpdateOwnerIdentity(
        await authenticateMobileToken(request.headers.get("authorization")),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_OWNER_IDENTITY_UPDATE", error)
    );
  }
}
