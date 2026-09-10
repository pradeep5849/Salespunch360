import { AuthorizationError, requireUser, requireUserForMutation } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { canAccessAccountWorkspace, canAccessSalesWorkspace } from "@/lib/auth/workspace-policy";
export async function requirePrimaryOwner(mutation=false){const actor=mutation?await requireUserForMutation():await requireUser();if(!actor.companyId||!actor.isActive||actor.salesRole!=="PRIMARY_ADMIN")throw new AuthorizationError();const company=await db.company.findUnique({where:{id:actor.companyId},select:{id:true,productEdition:true}});if(!company||(!canAccessSalesWorkspace(actor,company.productEdition)&&!canAccessAccountWorkspace(actor,company.productEdition)))throw new AuthorizationError();return{actor:{...actor,companyId:actor.companyId},company};}
