import {z} from "zod";
import {createFollowUpTaskForActor} from "@/lib/follow-up-tasks/service";
import type {MobilePrincipal} from "./auth";

const requestSchema=z.object({
 leadId:z.string().uuid(),
 followUpAt:z.string().min(10),
 notes:z.unknown().optional(),
 type:z.enum(["VISIT","CALL"]).default("VISIT"),
});

export async function mobileCreateFollowUp(user:MobilePrincipal,raw:unknown){
 const data=requestSchema.parse(raw);
 return createFollowUpTaskForActor({id:user.id,companyId:user.companyId,salesRole:user.salesRole,managerType:user.managerType,branchAccessScope:user.branchAccessScope,branchIds:user.branchIds},{leadId:data.leadId,dueDate:data.followUpAt.slice(0,10),notes:data.notes,type:data.type});
}
