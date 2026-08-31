import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";

const optional = (max: number) => z.string().trim().max(max).transform(v => v || null);
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(120), addressLine1: z.string().trim().min(2).max(200), addressLine2: optional(200), locality: optional(120),
  city: z.string().trim().min(2).max(120), state: z.string().trim().min(2).max(120), postalCode: z.string().trim().min(3).max(20), country: z.string().trim().min(2).max(120),
  primaryContactName: z.string().trim().min(2).max(120), primaryPhone: z.string().trim().min(5).max(30), contactEmail: z.string().trim().email().max(320).transform(v => v.toLowerCase()),
  alternatePhone: optional(30), website: z.union([z.literal(""), z.string().trim().url().max(300)]).transform(v => v || null), gstin: optional(30), pan: optional(20), registrationNumber: optional(60), description: optional(2000),
  teamStructure: z.enum(["MANAGERS_AND_SALES", "SALES_ONLY"]),
}).strict();

export const profileComplete = (company: Record<string, unknown>) => ["name","addressLine1","city","state","postalCode","country","primaryContactName","primaryPhone","contactEmail"].every(key => typeof company[key] === "string" && Boolean((company[key] as string).trim())) && (company.teamStructure === "MANAGERS_AND_SALES" || company.teamStructure === "SALES_ONLY");
export async function getCompanyProfile() { const actor=await requireRole("COMPANY_ADMIN","MANAGER","SALES"); if(!actor.companyId) throw new Error("NOT_FOUND"); return {profile:await db.company.findUniqueOrThrow({where:{id:actor.companyId}}),editable:actor.role==="COMPANY_ADMIN"}; }
export async function updateCompanyProfile(raw: unknown) { const actor=await requireRole("COMPANY_ADMIN"); if(!actor.companyId) throw new Error("NOT_FOUND"); const data=companyProfileSchema.parse(raw); return db.company.update({where:{id:actor.companyId},data}); }
