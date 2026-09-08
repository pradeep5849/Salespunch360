import type { ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashSessionToken, verifyPassword } from "@/lib/auth/crypto";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { clearUserAuthentication, lockUser } from "@/lib/auth/session-generation";
import { editionAllowsSalesWorkspace, canUseSalesFieldWorkflow } from "@/lib/auth/workspace-policy";
import { SALES_ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";

const MOBILE_SALES_ROLES: SalesRole[] = ["PRIMARY_ADMIN", "ADMIN", "MANAGER", "SALES"];
export const isMobileSalesRole = (role: SalesRole | null): role is SalesRole => role !== null && MOBILE_SALES_ROLES.includes(role);
const SESSION_DAYS = 30;

export type MobilePrincipal = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  salesRole: SalesRole;
  managerType: ManagerType | null;
  mobileSessionId?: string;
};

type Eligibility = { isActive: boolean; companyId: string | null; role: string; salesRole: SalesRole | null; salesAccessActive: boolean };
export function isMobileEligible(user: Eligibility, edition: ProductEdition | null): user is Eligibility & { companyId: string; salesRole: SalesRole } {
  return user.isActive && user.companyId !== null && user.role !== "SUPER_ADMIN" && user.salesAccessActive && isMobileSalesRole(user.salesRole) && edition !== null && editionAllowsSalesWorkspace(edition);
}
export const mobileCan = (user: MobilePrincipal, permission: Permission) => SALES_ROLE_PERMISSIONS[user.salesRole].includes(permission);
export const mobileFieldWorkEnabled = (user: MobilePrincipal) => canUseSalesFieldWorkflow(user);

export async function createMobileSession(identifier: string, password: string, now = new Date()) {
  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] },
    select: { id:true,name:true,email:true,passwordHash:true,role:true,salesRole:true,salesAccessActive:true,managerType:true,companyId:true,isActive:true,company:{select:{productEdition:true}} },
  });
  if (!user || !isMobileEligible(user, user.company?.productEdition ?? null) || !(await verifyPassword(user.passwordHash, password))) throw new Error("INVALID_MOBILE_CREDENTIALS");
  const token=createSessionToken(), expiresAt=new Date(now.getTime()+SESSION_DAYS*86_400_000);
  const lockedUser=await db.$transaction(async tx=>{
    const current=await lockUser(tx,user.id);
    const company=current?.companyId?await tx.company.findUnique({where:{id:current.companyId},select:{productEdition:true}}):null;
    if(!current||!isMobileEligible(current,company?.productEdition??null)||!(await verifyPassword(current.passwordHash,password)))throw new Error("INVALID_MOBILE_CREDENTIALS");
    const rotated=await tx.user.update({where:{id:current.id},data:{sessionVersion:{increment:1}},select:{sessionVersion:true}});
    await clearUserAuthentication(tx,current.id);
    await tx.mobileSession.create({data:{userId:current.id,tokenHash:hashSessionToken(token),expiresAt,lastUsedAt:now,sessionVersion:rotated.sessionVersion}});
    return current;
  });
  return {token,expiresAt,user:{id:lockedUser.id,name:lockedUser.name,email:lockedUser.email,companyId:lockedUser.companyId!,salesRole:lockedUser.salesRole!,managerType:lockedUser.managerType}};
}

export async function authenticateMobileToken(authorization:string|null,now=new Date()):Promise<MobilePrincipal>{
  const match=authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);if(!match)throw new Error("MOBILE_UNAUTHORIZED");
  const session=await db.mobileSession.findUnique({where:{tokenHash:hashSessionToken(match[1])},select:{id:true,expiresAt:true,revokedAt:true,lastUsedAt:true,sessionVersion:true,user:{select:{id:true,name:true,email:true,role:true,salesRole:true,salesAccessActive:true,managerType:true,companyId:true,isActive:true,sessionVersion:true,company:{select:{productEdition:true}}}}}});
  if(!session||session.revokedAt||session.expiresAt<=now||session.sessionVersion!==session.user.sessionVersion||!isMobileEligible(session.user,session.user.company?.productEdition??null))throw new Error("MOBILE_UNAUTHORIZED");
  if(now.getTime()-session.lastUsedAt.getTime()>300_000)await db.mobileSession.updateMany({where:{id:session.id,revokedAt:null},data:{lastUsedAt:now}});
  return{id:session.user.id,name:session.user.name,email:session.user.email,companyId:session.user.companyId,salesRole:session.user.salesRole,managerType:session.user.managerType,mobileSessionId:session.id};
}

export async function revokeMobileToken(authorization:string|null){const match=authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);if(match)await db.$transaction(async tx=>{const session=await tx.mobileSession.findUnique({where:{tokenHash:hashSessionToken(match[1])},select:{id:true}});if(!session)return;await tx.mobileSession.updateMany({where:{id:session.id,revokedAt:null},data:{revokedAt:new Date()}});await tx.pushDevice.deleteMany({where:{mobileSessionId:session.id}})})}

export async function mobileBootstrap(user:MobilePrincipal){
  const [company,attendance,entitlement]=await Promise.all([db.company.findUnique({where:{id:user.companyId},select:{name:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true,teamStructure:true,attendanceEnabled:true,gpsTrackingEnabled:true}}),mobileFieldWorkEnabled(user)?db.attendance.findFirst({where:{companyId:user.companyId,userId:user.id,endedAt:null},select:{id:true,startedAt:true}}):Promise.resolve(null),effectiveEntitlement(user.companyId)]);
  if(!company)throw new Error("MOBILE_UNAUTHORIZED");const address=[company.addressLine1,company.addressLine2,company.locality,company.city,company.state,company.postalCode,company.country].filter(Boolean).join(", ");
  return{user:{id:user.id,name:user.name,email:user.email,salesRole:user.salesRole,managerType:user.managerType},company:{name:company.name,logoUrl:null,address:address||null},teamStructure:company.teamStructure,features:{attendanceEnabled:company.attendanceEnabled,gpsTrackingEnabled:company.gpsTrackingEnabled,fieldWorkEnabled:mobileFieldWorkEnabled(user)},capabilities:{canManageEmployees:mobileCan(user,"SALES_USER_ADMIN"),canManageSalesSettings:mobileCan(user,"SALES_SETTINGS"),canAccessSalesBilling:mobileCan(user,"SALES_BILLING"),canViewReports:mobileCan(user,"SALES_REPORTS")},entitlement:{state:entitlement.state,operationalWritesAllowed:entitlement.operationalWritesAllowed,adminLimit:entitlement.adminLimit,adminUsage:entitlement.adminUsage,managerLimit:entitlement.managerLimit,salesLimit:entitlement.salesLimit,managerUsage:entitlement.managerUsage,salesUsage:entitlement.salesUsage},attendance};
}
