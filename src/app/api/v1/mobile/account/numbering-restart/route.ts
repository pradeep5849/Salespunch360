import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { mobileUnauthorized } from "@/lib/mobile/http";
import {
  numberingRestartOptions,
  numberingRestartFailure,
} from "@/lib/account/numbering-restart";
import { numberingRestartRequest } from "@/lib/account/numbering-restart-request";
async function actor(request: Request) {
  return permit(
    await authenticateMobileToken(request.headers.get("authorization")),
    "ACCOUNT_SETTINGS",
  );
}
export async function GET(request: Request) {
  try {
    return Response.json(await numberingRestartOptions(await actor(request)));
  } catch (error) {
    return mobileUnauthorized(error) ?? numberingRestartFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    return Response.json(
      await numberingRestartRequest(await actor(request), await request.json()),
    );
  } catch (error) {
    return mobileUnauthorized(error) ?? numberingRestartFailure(error);
  }
}
