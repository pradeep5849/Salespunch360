import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileCreateProject,
  mobileProjectList,
  mobileUpdateProject,
} from "@/lib/mobile/account-projects";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const x = new URL(r.url);
    return mobileJson(
      await mobileProjectList(
        await authenticateMobileToken(r.headers.get("authorization")),
        x.searchParams.get("q"),
        x.searchParams.get("status"),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_PROJECT_LIST", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    return mobileJson(
      await mobileCreateProject(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
      201,
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("MOBILE_PROJECT_CREATE", e)
    );
  }
}
export async function PATCH(r: Request) {
  try {
    return mobileJson(
      await mobileUpdateProject(
        await authenticateMobileToken(r.headers.get("authorization")),
        await r.json(),
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_PROJECT_UPDATE", e)
    );
  }
}
