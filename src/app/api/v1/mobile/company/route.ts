import { authenticateMobileSalesToken } from "@/lib/mobile/auth";
import { mobileCompanyContext, mobileUpdateCompany, MobileCompanyError } from "@/lib/mobile/company";
import { mobileBranchFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
import { ZodError } from "zod";

const principal = (request: Request) => authenticateMobileSalesToken(request.headers.get("authorization"));
function failure(error: unknown) {
  if (error instanceof MobileCompanyError) return mobileJson({ error: error.code }, error.status);
  const expected = mobileUnauthorized(error) ?? mobileBranchFailure(error);
  if (expected) return expected;
  if (error instanceof SyntaxError || error instanceof ZodError) return mobileJson({ error: "INVALID_INPUT" }, 400);
  return mobileUnexpected("MOBILE_COMPANY", error);
}
export async function GET(request: Request) {
  try { return mobileJson(await mobileCompanyContext(await principal(request))); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try { return mobileJson(await mobileUpdateCompany(await principal(request), await request.json())); } catch (error) { return failure(error); }
}
