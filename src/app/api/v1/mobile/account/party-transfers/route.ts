import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {savePartyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferDto,partyTransferJson,partyTransferForm,partyTransferFailure} from "@/lib/account/party-transfer-http";
export async function POST(request:Request){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));const form=await partyTransferForm(request);return partyTransferJson(partyTransferDto(await savePartyTransferForActor(actor,form.input,form.file)),201);}catch(error){return partyTransferFailure(error)}}
