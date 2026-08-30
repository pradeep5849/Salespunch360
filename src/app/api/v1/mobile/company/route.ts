import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileCompanyContext, mobileUpdateCompany, MobileCompanyError } from "@/lib/mobile/company";
import { mobileJson } from "@/lib/mobile/http";

const principal = (request: Request) => authenticateMobileToken(request.headers.get("authorization"));
function failure(error: unknown) {
  if (error instanceof MobileCompanyError) return mobileJson({ error: error.code }, error.status);
  const code = error instanceof Error ? error.message : "";
  if (code === "MOBILE_UNAUTHORIZED") return mobileJson({ error: "UNAUTHORIZED" }, 401);
  return mobileJson({ error: "INVALID_INPUT" }, 400);
}
export async function GET(request: Request) {
  try { return mobileJson(await mobileCompanyContext(await principal(request))); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try { return mobileJson(await mobileUpdateCompany(await principal(request), await request.json())); } catch (error) { return failure(error); }
}
