import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileImportPreview,
  mobileUtilities,
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
  mobileUnexpected("MOBILE_ACCOUNT_IMPORT", e);
export async function GET(r: Request) {
  try {
    return mobileJson(
      await mobileUtilities(
        await authenticateMobileToken(r.headers.get("authorization")),
        "imports",
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(r: Request) {
  try {
    const d = await r.formData(),
      file = d.get("file");
    if (!(file instanceof File)) throw new Error("INVALID_IMPORT_FILE");
    return mobileJson(
      await mobileImportPreview(
        await authenticateMobileToken(r.headers.get("authorization")),
        String(d.get("type")),
        file,
        d.get("updateExisting") === "true",
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
