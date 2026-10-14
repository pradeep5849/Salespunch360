import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileCompleteServiceReminder} from "@/lib/mobile/account-administration";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import {accountErrorMessage,isAccountDomainError} from "@/lib/account/action-feedback";
export async function POST(r:Request){try{return mobileJson(await mobileCompleteServiceReminder(await authenticateMobileToken(r.headers.get("authorization")),await r.json()))}catch(error){if(isAccountDomainError(error))return Response.json({error:accountErrorMessage(error)},{status:400});return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_SERVICE_REMINDER_COMPLETE",error)}}
