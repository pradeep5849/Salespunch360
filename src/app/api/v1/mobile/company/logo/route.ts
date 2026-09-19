import { authenticateMobileSalesToken } from "@/lib/mobile/auth";
import { mobileUpdateCompanyLogo, MobileCompanyError } from "@/lib/mobile/company";
import { mobileBranchFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";

const principal = (request: Request) => authenticateMobileSalesToken(request.headers.get("authorization"));

function failure(error: unknown) {
  if (error instanceof MobileCompanyError) return mobileJson({ error: error.code }, error.status);
  const expected = mobileUnauthorized(error) ?? mobileBranchFailure(error);
  if (expected) return expected;
  if (error instanceof SyntaxError) return mobileJson({ error: "LOGO_INVALID" }, 400);
  return mobileUnexpected("MOBILE_COMPANY_LOGO", error);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File)) return mobileJson({ error: "LOGO_INVALID" }, 400);
    return mobileJson(await mobileUpdateCompanyLogo(await principal(request), logo));
  } catch (error) {
    return failure(error);
  }
}
