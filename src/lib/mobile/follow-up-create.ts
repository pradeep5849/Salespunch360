import {z} from "zod";
import {createFollowUpTaskForActor} from "@/lib/follow-up-tasks/service";
import type {MobilePrincipal} from "./auth";

const CALL_MARKER="[[SP360_CLIENT_TYPE:CALL]]";
const requestSchema=z.object({
 leadId:z.string().uuid(),
 followUpAt:z.string().min(10),
 notes:z.unknown().optional(),
 type:z.enum(["VISIT","CALL"]).optional(),
});

export async function mobileCreateFollowUp(user:MobilePrincipal,raw:unknown){
 const data=requestSchema.parse(raw),rawNotes=typeof data.notes==="string"?data.notes:"",markedCall=rawNotes.startsWith(CALL_MARKER),type=data.type??(markedCall?"CALL":"VISIT"),notes=markedCall?rawNotes.slice(CALL_MARKER.length).replace(/^\n/,""):data.notes;
 return createFollowUpTaskForActor({id:user.id,companyId:user.companyId,salesRole:user.salesRole,managerType:user.managerType,branchAccessScope:user.branchAccessScope,branchIds:user.branchIds},{leadId:data.leadId,dueDate:data.followUpAt.slice(0,10),notes,type});
}
