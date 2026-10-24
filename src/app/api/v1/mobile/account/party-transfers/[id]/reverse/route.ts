import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {reversePartyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferJson,partyTransferFailure} from "@/lib/account/party-transfer-http";
import {readTransferRequestJson} from "@/lib/mobile/transfer-request";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));return partyTransferJson(await reversePartyTransferForActor(actor,(await context.params).id,await readTransferRequestJson(request)))}catch(error){return partyTransferFailure(error)}}
