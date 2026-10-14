import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileAssetFundingMutation, mobileAssetFundingOptions } from "@/lib/mobile/account-money";
import { mobileAuthorizationFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
function failure(error: unknown) {
  return mobileUnauthorized(error) ?? mobileAuthorizationFailure(error) ?? mobileUnexpected("MOBILE_ASSET_FUNDING", error);
}
export async function GET(request: Request) {
  try {
    const actor = await authenticateMobileToken(request.headers.get("authorization"));
    return mobileJson(await mobileAssetFundingOptions(actor, Object.fromEntries(new URL(request.url).searchParams)));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await authenticateMobileToken(request.headers.get("authorization"));
    return mobileJson(await mobileAssetFundingMutation(actor, await request.json()), 201);
  } catch (error) { return failure(error); }
}
