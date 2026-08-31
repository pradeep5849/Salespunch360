"use server";
import { revalidatePath } from "next/cache";
import { updateCompanyProfile } from "@/lib/company/profile";
export type CompanyProfileState={error?:string;success?:string;fieldErrors?:Record<string,string[]>};
export async function saveCompanyProfile(_:CompanyProfileState,formData:FormData):Promise<CompanyProfileState>{const raw=Object.fromEntries(formData);try{await updateCompanyProfile(raw);revalidatePath("/workspace");revalidatePath("/workspace/company-profile");return{success:"Company details saved."};}catch(error){const issues=error&&typeof error==='object'&&'flatten'in error?(error as {flatten:()=>{fieldErrors:Record<string,string[]>}}).flatten().fieldErrors:undefined;return{error:"Review the company details and try again.",fieldErrors:issues};}}
