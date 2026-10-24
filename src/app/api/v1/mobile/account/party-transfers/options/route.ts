import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {partyTransferOptionsForActor} from "@/lib/account/party-transfers";
import {partyTransferJson,partyTransferFailure} from "@/lib/account/party-transfer-http";
export async function GET(request:Request){try{return partyTransferJson(await partyTransferOptionsForActor(mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")))))}catch(error){return partyTransferFailure(error)}}
