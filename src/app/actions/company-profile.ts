"use server";
import { revalidatePath } from "next/cache";
import { updateCompanyProfile } from "@/lib/company/profile";
import { requirePrimaryOwner } from "@/lib/company/owner-authorization";
import { companyLogoKey, processCompanyLogo } from "@/lib/company/logo";
import { privateStorage } from "@/lib/storage";
import { db } from "@/lib/db";
export type CompanyProfileState={error?:string;success?:string;fieldErrors?:Record<string,string[]>};
const profileError=(error:unknown)=>error instanceof Error&&error.message==="TEAM_STRUCTURE_CONFLICT"?"Remove active Manager seats and Managers before changing to a direct Sales Team.":error instanceof Error&&error.message==="MODULE_NOT_AVAILABLE_FOR_PRODUCT"?"Sales modules are not available for this product.":error instanceof Error&&error.message&&!["NEXT_REDIRECT"].includes(error.message)?error.message:"Unable to save Company details.";
export async function saveCompanyProfile(_:CompanyProfileState,formData:FormData):Promise<CompanyProfileState>{
 const raw:Record<string,unknown>={...Object.fromEntries(formData),enabledModules:[]};delete raw.companyLogo;
 try{await updateCompanyProfile(raw);revalidatePath("/workspace");revalidatePath("/workspace/account");revalidatePath("/workspace/company-profile");return{success:"Saved successfully."};}
 catch(error){const issues=error&&typeof error==='object'&&'flatten'in error?(error as {flatten:()=>{fieldErrors:Record<string,string[]>}}).flatten().fieldErrors:undefined;return{error:issues?"Please correct the highlighted fields.":profileError(error),fieldErrors:issues};}
}

export async function replaceCompanyLogo(_:CompanyProfileState,formData:FormData):Promise<CompanyProfileState>{try{const {actor}=await requirePrimaryOwner(true);const file=formData.get("companyLogo");if(!(file instanceof File)||!file.size)throw new Error("LOGO_INVALID");const data=await processCompanyLogo(file),key=companyLogoKey(actor.companyId);await privateStorage().put(key,data);await db.company.update({where:{id:actor.companyId},data:{logoObjectKey:key}});revalidatePath("/workspace");revalidatePath("/workspace/account");revalidatePath("/workspace/company-profile");return{success:"Company logo updated."};}catch(error){return{error:error instanceof Error&&error.message==="LOGO_INVALID"?"Choose a valid JPEG, PNG, or WebP image up to 5 MB.":"Unable to update the company logo."};}}
