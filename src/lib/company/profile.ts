import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { lockBillingCompany } from "@/lib/billing/company-lock";

const optional = (max: number) => z.string().trim().max(max).transform(v => v || null);
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(120), addressLine1: z.string().trim().min(2).max(200), addressLine2: optional(200), locality: optional(120),
  city: z.string().trim().min(2).max(120), state: z.string().trim().min(2).max(120), postalCode: z.string().trim().min(3).max(20), country: z.string().trim().min(2).max(120),
  primaryContactName: z.string().trim().min(2).max(120), primaryPhone: z.string().trim().min(5).max(30), contactEmail: z.string().trim().email().max(320).transform(v => v.toLowerCase()),
  alternatePhone: optional(30), website: z.union([z.literal(""), z.string().trim().url().max(300)]).transform(v => v || null), gstin: optional(30), pan: optional(20), registrationNumber: optional(60), description: optional(2000),
  teamStructure: z.enum(["MANAGERS_AND_SALES", "SALES_ONLY"]),
}).strict();

export const profileComplete = (company: Record<string, unknown>) => ["name","addressLine1","city","state","postalCode","country","primaryContactName","primaryPhone","contactEmail"].every(key => typeof company[key] === "string" && Boolean((company[key] as string).trim())) && (company.teamStructure === "MANAGERS_AND_SALES" || company.teamStructure === "SALES_ONLY");
export const companyProfileSelect = {
  name:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true,alternatePhone:true,website:true,gstin:true,pan:true,registrationNumber:true,description:true,teamStructure:true,logoObjectKey:true,updatedAt:true,
} satisfies Prisma.CompanySelect;

export type CompanyProfileDto = {
  name:string;addressLine1:string|null;addressLine2:string|null;locality:string|null;city:string|null;state:string|null;postalCode:string|null;country:string|null;primaryContactName:string|null;primaryPhone:string|null;contactEmail:string|null;alternatePhone:string|null;website:string|null;gstin:string|null;pan:string|null;registrationNumber:string|null;description:string|null;teamStructure:"MANAGERS_AND_SALES"|"SALES_ONLY";hasLogo:boolean;logoVersion:string;
};

export async function getCompanyProfile() {
  const actor=await requirePermission("COMPANY_VIEW");
  if(!actor.companyId)throw new Error("NOT_FOUND");
  const company=await db.company.findUniqueOrThrow({where:{id:actor.companyId},select:companyProfileSelect});
  const profile:CompanyProfileDto={
    name:company.name,addressLine1:company.addressLine1,addressLine2:company.addressLine2,locality:company.locality,city:company.city,state:company.state,postalCode:company.postalCode,country:company.country,
    primaryContactName:company.primaryContactName||actor.name,primaryPhone:company.primaryPhone,contactEmail:company.contactEmail||actor.email,alternatePhone:company.alternatePhone,website:company.website,gstin:company.gstin,pan:company.pan,registrationNumber:company.registrationNumber,description:company.description,teamStructure:company.teamStructure,
    hasLogo:Boolean(company.logoObjectKey),logoVersion:company.updatedAt.toISOString(),
  };
  return{profile,editable:actor.salesRole==="PRIMARY_ADMIN"};
}

export async function updateCompanyProfile(raw: unknown) {
  const actor=await requirePermissionForMutation("SALES_SETTINGS");
  if(!actor.companyId)throw new Error("NOT_FOUND");
  const companyId=actor.companyId;
  const data=companyProfileSchema.parse(raw);
  return db.$transaction(async tx=>{
    const company=await lockBillingCompany(tx,companyId);
    if(company.teamStructure==="MANAGERS_AND_SALES"&&data.teamStructure==="SALES_ONLY"){
      const now=new Date();
      const activeManagers=await tx.user.count({where:{companyId,salesRole:"MANAGER",isActive:true,salesAccessActive:true}});
      if(activeManagers>0)throw new Error("TEAM_STRUCTURE_CONFLICT");
      const pendingManagerOrder=await tx.billingOrder.findFirst({where:{companyId,status:"PENDING",managerSeats:{gt:0},OR:[{expiresAt:null},{expiresAt:{gt:now}}]},select:{id:true}});
      if(pendingManagerOrder)throw new Error("TEAM_STRUCTURE_CONFLICT");
      const activeManagerSubscription=await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",managerSeats:{gt:0},endsAt:{gt:now}},select:{id:true}});
      if(activeManagerSubscription)throw new Error("TEAM_STRUCTURE_CONFLICT");
    }
    return tx.company.update({where:{id:companyId},data});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
