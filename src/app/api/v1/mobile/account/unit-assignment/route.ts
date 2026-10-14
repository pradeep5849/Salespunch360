import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAssignUnitToItems,mobileUnitAssignmentOptions} from "@/lib/mobile/account-master-data";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
export async function GET(request:Request){try{return mobileJson(await mobileUnitAssignmentOptions(await authenticateMobileToken(request.headers.get("authorization")),Object.fromEntries(new URL(request.url).searchParams)));}catch(error){return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_UNIT_ASSIGNMENT_OPTIONS",error);}}
export async function POST(request:Request){try{return mobileJson(await mobileAssignUnitToItems(await authenticateMobileToken(request.headers.get("authorization")),await request.json()));}catch(error){return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_UNIT_ASSIGNMENT",error);}}
