import {AuthorizationError,requirePermissionForMutation} from "@/lib/auth/authorization";
import {partyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferDto,partyTransferJson,partyTransferFailure} from "@/lib/account/party-transfer-http";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const actor=await requirePermissionForMutation("ACCOUNT_MONEY_VIEW");if(!actor.companyId)throw new AuthorizationError();return partyTransferJson(partyTransferDto(await partyTransferForActor({...actor,companyId:actor.companyId},(await context.params).id)));}catch(error){return partyTransferFailure(error)}}
