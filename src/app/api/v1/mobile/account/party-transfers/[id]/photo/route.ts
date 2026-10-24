import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {partyTransferPhotoForActor} from "@/lib/account/party-transfers";
import {partyTransferFailure,partyTransferPhotoResponse} from "@/lib/account/party-transfer-http";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));return partyTransferPhotoResponse(await partyTransferPhotoForActor(actor,(await context.params).id));}catch(error){return partyTransferFailure(error)}}
