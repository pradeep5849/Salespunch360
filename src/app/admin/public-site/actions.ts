"use server";
import {revalidatePath} from "next/cache";
import {db} from "@/lib/db";
import {requireGlobalSuperAdmin} from "@/lib/auth/authorization";
const url=(v:FormDataEntryValue|null)=>{const s=String(v??"").trim();if(!s)return null;try{const u=new URL(s);return u.protocol==="https:"?u.toString():null}catch{return null}};
export async function updatePublicSiteSettingsAction(fd:FormData){await requireGlobalSuperAdmin();const data={facebookUrl:url(fd.get("facebookUrl")),instagramUrl:url(fd.get("instagramUrl")),linkedinUrl:url(fd.get("linkedinUrl")),youtubeUrl:url(fd.get("youtubeUrl"))};await db.publicSiteSettings.upsert({where:{id:"default"},create:{id:"default",...data},update:data});revalidatePath("/");revalidatePath("/admin/public-site")}
