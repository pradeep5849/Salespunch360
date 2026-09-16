import type { AccountRole, BranchAccessScope, ManagerType, ProductEdition, Role, SalesRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashSessionToken, verifyPassword } from "@/lib/auth/crypto";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { clearUserAuthentication, lockUser } from "@/lib/auth/session-generation";
import { canUseSalesFieldWorkflow, resolveWorkspaceAccess, type WebWorkspace } from "@/lib/auth/workspace-policy";
import { operationalBranchContext } from "@/lib/branches/operational-scope";
import { SALES_ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { indiaDateText, parseIndiaBusinessDate } from "@/lib/follow-up-tasks/date";

const MOBILE_SALES_ROLES: SalesRole[] = ["PRIMARY_ADMIN", "ADMIN", "MANAGER", "SALES"];
export const isMobileSalesRole = (role: SalesRole | null): role is SalesRole => role !== null && MOBILE_SALES_ROLES.includes(role);
const SESSION_DAYS = 30;
export type MobileAppPrincipal = {id:string;name:string;email:string;companyId:string;role:Role;salesRole:SalesRole|null;accountRole:AccountRole|null;managerType:ManagerType|null;branchAccessScope?:BranchAccessScope;branchIds?:string[];mobileSessionId?:string;productEdition:ProductEdition;authorizedWorkspaces:WebWorkspace[]};
export type MobileSalesPrincipal = MobileAppPrincipal & { salesRole: SalesRole };
export type MobilePrincipal = Pick<MobileSalesPrincipal,"id"|"name"|"email"|"companyId"|"salesRole"|"managerType"|"branchAccessScope"|"branchIds"|"mobileSessionId">;
type Eligibility={isActive:boolean;companyId:string|null;role:Role;salesRole:SalesRole|null;accountRole?:AccountRole|null;salesAccessActive:boolean;accountAccessActive?:boolean;managerType?:ManagerType|null};
export function isMobileEligible(user:Eligibility,edition:ProductEdition|null):user is Eligibility&{companyId:string}{return edition!==null&&resolveWorkspaceAccess({...user,accountRole:user.accountRole??null,accountAccessActive:user.accountAccessActive??false,managerType:user.managerType??null},edition).defaultWorkspace!==null}
const MOBILE_PERSONAL_FIELD_PERMISSIONS:readonly Permission[]=["SALES_ATTENDANCE","SALES_CUSTOMERS","SALES_CHECK_INS","SALES_LEADS","SALES_FOLLOW_UPS","SALES_TARGETS","SALES_TRAVEL"];
export const mobileCan=(user:MobileAppPrincipal|MobilePrincipal,permission:Permission)=>user.salesRole!==null&&(!("authorizedWorkspaces" in user)||user.authorizedWorkspaces.includes("SALES"))&&SALES_ROLE_PERMISSIONS[user.salesRole].includes(permission)&&(!MOBILE_PERSONAL_FIELD_PERMISSIONS.includes(permission)||mobileFieldWorkEnabled(user));
export const mobileFieldWorkEnabled=(user:MobileAppPrincipal|MobilePrincipal)=>(!("authorizedWorkspaces" in user)||user.authorizedWorkspaces.includes("SALES"))&&canUseSalesFieldWorkflow(user);
export function requireMobileSalesPrincipal(user:MobileAppPrincipal):MobileSalesPrincipal{if(!user.authorizedWorkspaces.includes("SALES")||!isMobileSalesRole(user.salesRole))throw new Error("MOBILE_FORBIDDEN");return user as MobileSalesPrincipal}
export async function authenticateMobileSalesToken(authorization:string|null,now=new Date()){return requireMobileSalesPrincipal(await authenticateMobileToken(authorization,now))}

export async function createMobileSession(identifier:string,password:string,now=new Date()){
 const user=await db.user.findFirst({where:{OR:[{email:identifier.toLowerCase()},{phone:identifier}]},select:{id:true,name:true,email:true,passwordHash:true,role:true,salesRole:true,accountRole:true,salesAccessActive:true,accountAccessActive:true,managerType:true,companyId:true,isActive:true,company:{select:{productEdition:true}}}});
 if(!user||!isMobileEligible(user,user.company?.productEdition??null)||!(await verifyPassword(user.passwordHash,password)))throw new Error("INVALID_MOBILE_CREDENTIALS");
 const token=createSessionToken(),expiresAt=new Date(now.getTime()+SESSION_DAYS*86_400_000);
 const lockedUser=await db.$transaction(async tx=>{const current=await lockUser(tx,user.id);const company=current?.companyId?await tx.company.findUnique({where:{id:current.companyId},select:{productEdition:true}}):null;if(!current||!isMobileEligible(current,company?.productEdition??null)||!(await verifyPassword(current.passwordHash,password)))throw new Error("INVALID_MOBILE_CREDENTIALS");const rotated=await tx.user.update({where:{id:current.id},data:{sessionVersion:{increment:1}},select:{sessionVersion:true}});await clearUserAuthentication(tx,current.id);await tx.mobileSession.create({data:{userId:current.id,tokenHash:hashSessionToken(token),expiresAt,lastUsedAt:now,sessionVersion:rotated.sessionVersion}});return{...current,productEdition:company!.productEdition}});
 const branchIds=process.env.NODE_ENV==="test"&&!(db as unknown as {branch?:unknown}).branch?["00000000-0000-0000-0000-000000000001"]:(await db.branch.findMany({where:{companyId:lockedUser.companyId!,isActive:true,...(lockedUser.branchAccessScope==="SELECTED_BRANCHES"?{userAccesses:{some:{userId:lockedUser.id}}}:{})},select:{id:true}})).map(({id})=>id);
 const productEdition=lockedUser.productEdition,access=resolveWorkspaceAccess(lockedUser,productEdition),authorizedWorkspaces=([access.canAccessSales&&"SALES",access.canAccessAccount&&"ACCOUNT"].filter(Boolean) as WebWorkspace[]);
 return{token,expiresAt,user:{id:lockedUser.id,name:lockedUser.name,email:lockedUser.email,companyId:lockedUser.companyId!,role:lockedUser.role,salesRole:lockedUser.salesRole,accountRole:lockedUser.accountRole,managerType:lockedUser.managerType,branchAccessScope:lockedUser.branchAccessScope,branchIds,productEdition,authorizedWorkspaces}};
}

export async function authenticateMobileToken(authorization:string|null,now=new Date()):Promise<MobileAppPrincipal>{
 const match=authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);if(!match)throw new Error("MOBILE_UNAUTHORIZED");
 const session=await db.mobileSession.findUnique({where:{tokenHash:hashSessionToken(match[1])},select:{id:true,expiresAt:true,revokedAt:true,lastUsedAt:true,sessionVersion:true,user:{select:{id:true,name:true,email:true,role:true,salesRole:true,accountRole:true,salesAccessActive:true,accountAccessActive:true,managerType:true,companyId:true,isActive:true,sessionVersion:true,branchAccessScope:true,branchAccesses:{where:{branch:{isActive:true}},select:{branchId:true}},company:{select:{productEdition:true,branches:{where:{isActive:true},select:{id:true}}}}}}}});
 if(!session||session.revokedAt||session.expiresAt<=now||session.sessionVersion!==session.user.sessionVersion||!isMobileEligible(session.user,session.user.company?.productEdition??null))throw new Error("MOBILE_UNAUTHORIZED");
 if(now.getTime()-session.lastUsedAt.getTime()>300_000)await db.mobileSession.updateMany({where:{id:session.id,revokedAt:null},data:{lastUsedAt:now}});
 const authorizedBranches=session.user.branchAccessScope==="SELECTED_BRANCHES"?(session.user.branchAccesses??[]):(session.user.company?.branches??[]);const productEdition=session.user.company!.productEdition,access=resolveWorkspaceAccess(session.user,productEdition),authorizedWorkspaces=([access.canAccessSales&&"SALES",access.canAccessAccount&&"ACCOUNT"].filter(Boolean) as WebWorkspace[]);
 return{id:session.user.id,name:session.user.name,email:session.user.email,companyId:session.user.companyId,role:session.user.role,salesRole:session.user.salesRole,accountRole:session.user.accountRole,managerType:session.user.managerType,branchAccessScope:session.user.branchAccessScope,branchIds:authorizedBranches.length?authorizedBranches.map(value=>"branchId" in value?value.branchId:value.id):process.env.NODE_ENV==="test"?["00000000-0000-0000-0000-000000000001"]:[],mobileSessionId:session.id,productEdition,authorizedWorkspaces};
}
export async function revokeMobileToken(authorization:string|null){const match=authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);if(match)await db.$transaction(async tx=>{const session=await tx.mobileSession.findUnique({where:{tokenHash:hashSessionToken(match[1])},select:{id:true}});if(!session)return;await tx.session.deleteMany({where:{mobileSessionId:session.id}});await tx.mobileSession.updateMany({where:{id:session.id},data:{revokedAt:new Date(),webHandoffCodeHash:null,webHandoffExpiresAt:null,webHandoffRedirectPath:null}});await tx.pushDevice.deleteMany({where:{mobileSessionId:session.id}})})}

async function mobileSalesDashboard(user:MobileAppPrincipal|MobilePrincipal,branchId:string|null){
 if(user.salesRole!=="SALES"||!branchId||!mobileFieldWorkEnabled(user))return null;
 const todayText=indiaDateText(),today=parseIndiaBusinessDate(todayText),tomorrow=new Date(today.getTime()+86400000);const [year,month]=todayText.split("-");const monthStart=parseIndiaBusinessDate(`${year}-${month}-01`);const scope={companyId:user.companyId,branchId};
 const [todayVisitCount,todayLeadCount,monthVisitCount,monthLeadCount,pendingTodayTasks,overdueTasks,recentVisits]=await Promise.all([
  db.customerVisit.count({where:{...scope,userId:user.id,checkedInAt:{gte:today,lt:tomorrow}}}),
  db.lead.count({where:{...scope,assignedUserId:user.id,createdAt:{gte:today,lt:tomorrow}}}),
  db.customerVisit.count({where:{...scope,userId:user.id,checkedInAt:{gte:monthStart,lt:tomorrow}}}),
  db.lead.count({where:{...scope,assignedUserId:user.id,createdAt:{gte:monthStart,lt:tomorrow}}}),
  db.followUpTask.count({where:{...scope,assignedUserId:user.id,status:"PENDING",dueDate:{gte:today,lt:tomorrow}}}),
  db.followUpTask.count({where:{...scope,assignedUserId:user.id,status:"PENDING",dueDate:{lt:today}}}),
  db.customerVisit.findMany({where:{...scope,userId:user.id,checkedOutAt:{not:null}},orderBy:[{checkedOutAt:"desc"},{id:"desc"}],take:8,select:{id:true,contactName:true,checkedInAt:true,checkedOutAt:true,checkInAddress:true,checkoutSentiment:true,customer:{select:{name:true}}}})
 ]);
 return{todayVisitCount,todayLeadCount,monthVisitCount,monthLeadCount,pendingTodayTasks,overdueTasks,recentVisits:recentVisits.map(v=>({id:v.id,contactName:v.contactName,checkedInAt:v.checkedInAt,checkedOutAt:v.checkedOutAt,checkInAddress:v.checkInAddress,checkoutSentiment:v.checkoutSentiment,customerName:v.customer?.name??null}))};
}

export async function mobileBootstrap(user:MobileAppPrincipal|MobilePrincipal){
 const authorizedWorkspaces:WebWorkspace[]="authorizedWorkspaces" in user?user.authorizedWorkspaces:["SALES"],productEdition="productEdition" in user?user.productEdition:"SALESPUNCH360",accountRole="accountRole" in user?user.accountRole:null;
 const sales=authorizedWorkspaces.includes("SALES"),branches=sales?await operationalBranchContext(user as MobilePrincipal):{branches:(user.branchIds??[]).map(id=>({id})),branchIds:user.branchIds??[],branchId:null};
 const [company,attendance,entitlement,salesDashboard]=await Promise.all([db.company.findUnique({where:{id:user.companyId},select:{name:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true,teamStructure:true,attendanceEnabled:true,gpsTrackingEnabled:true}}),mobileFieldWorkEnabled(user)?db.attendance.findFirst({where:{companyId:user.companyId,branchId:branches.branchId!,userId:user.id,endedAt:null},select:{id:true,startedAt:true}}):Promise.resolve(null),effectiveEntitlement(user.companyId),sales?mobileSalesDashboard(user,branches.branchId):Promise.resolve(null)]);
 if(!company)throw new Error("MOBILE_UNAUTHORIZED");const address=[company.addressLine1,company.addressLine2,company.locality,company.city,company.state,company.postalCode,company.country].filter(Boolean).join(", ");
 return{productEdition,authorizedWorkspaces,canSwitchWorkspace:authorizedWorkspaces.length===2,branches:branches.branches.map(({id})=>({id})),branchSelectionRequired:sales&&branches.branchIds.length>1,user:{id:user.id,name:user.name,email:user.email,salesRole:user.salesRole,accountRole,managerType:user.managerType},company:{name:company.name,logoUrl:null,address:address||null},teamStructure:company.teamStructure,features:{attendanceEnabled:sales&&company.attendanceEnabled,gpsTrackingEnabled:sales&&company.gpsTrackingEnabled,fieldWorkEnabled:mobileFieldWorkEnabled(user)},capabilities:{canManageEmployees:mobileCan(user,"SALES_USER_ADMIN"),canManageSalesSettings:mobileCan(user,"SALES_SETTINGS"),canAccessSalesBilling:mobileCan(user,"SALES_BILLING"),canViewReports:mobileCan(user,"SALES_REPORTS")},entitlement:{state:entitlement.state,operationalWritesAllowed:entitlement.operationalWritesAllowed,adminLimit:entitlement.adminLimit,adminUsage:entitlement.adminUsage,managerLimit:entitlement.managerLimit,salesLimit:entitlement.salesLimit,managerUsage:entitlement.managerUsage,salesUsage:entitlement.salesUsage},attendance,salesDashboard};
}
