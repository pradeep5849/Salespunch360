import {AuthorizationError,requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {savePartyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferDto,partyTransferJson,partyTransferForm,partyTransferFailure} from "@/lib/account/party-transfer-http";
export async function POST(request:Request){try{const actor=await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");if(!actor.companyId)throw new AuthorizationError();await mutationGuard("party-transfer-create");const form=await partyTransferForm(request);return partyTransferJson(partyTransferDto(await savePartyTransferForActor({...actor,companyId:actor.companyId},form.input,form.file)),201);}catch(error){return partyTransferFailure(error)}}
