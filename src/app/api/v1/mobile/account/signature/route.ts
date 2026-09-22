import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileSignatureImage,
  mobileSignatureRemove,
  mobileSignatureUpload,
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
  mobileUnexpected("MOBILE_ACCOUNT_SIGNATURE", e);
export async function GET(r: Request) {
  try {
    return new Response(
      new Uint8Array(
        await mobileSignatureImage(
          await authenticateMobileToken(r.headers.get("authorization")),
        ),
      ),
      {
        headers: {
          "content-type": "image/webp",
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(r: Request) {
  try {
    const f = (await r.formData()).get("signature");
    if (!(f instanceof File)) throw new Error("SIGNATURE_INVALID");
    return mobileJson(
      await mobileSignatureUpload(
        await authenticateMobileToken(r.headers.get("authorization")),
        f,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(r: Request) {
  try {
    return mobileJson(
      await mobileSignatureRemove(
        await authenticateMobileToken(r.headers.get("authorization")),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
