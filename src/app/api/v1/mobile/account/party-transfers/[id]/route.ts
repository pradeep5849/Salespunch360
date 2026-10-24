import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {partyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferDto,partyTransferJson,partyTransferFailure} from "@/lib/account/party-transfer-http";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));return partyTransferJson(partyTransferDto(await partyTransferForActor(actor,(await context.params).id)));}catch(error){return partyTransferFailure(error)}}
