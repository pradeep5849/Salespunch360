import {requirePermissionForMutation,AuthorizationError} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {reversePartyTransferForActor} from "@/lib/account/party-transfers";
import {partyTransferJson,partyTransferFailure} from "@/lib/account/party-transfer-http";
import {readTransferRequestJson} from "@/lib/mobile/transfer-request";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const user=await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");if(!user.companyId)throw new AuthorizationError();await mutationGuard("party-transfer-reverse");const actor={...user,companyId:user.companyId};return partyTransferJson(await reversePartyTransferForActor(actor,(await context.params).id,await readTransferRequestJson(request)))}catch(error){return partyTransferFailure(error)}}
