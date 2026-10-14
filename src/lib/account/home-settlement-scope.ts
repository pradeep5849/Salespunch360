import type {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import type {AccountBranchActor} from "./branch-context";
/** AccountSettlement stores a scalar projectId, not a Prisma project relation. */
export async function homeSettlementProjectScope(actor:AccountBranchActor):Promise<Pick<Prisma.AccountSettlementWhereInput,"projectId">>{
 if(actor.accountRole!=="PROJECT_MANAGER")return {};
 const projects=await db.project.findMany({where:{companyId:actor.companyId,projectManagerId:actor.id,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:[...(actor.branchIds??[])]}}:{})},select:{id:true}});
 return{projectId:{in:projects.map(row=>row.id)}};
}
