"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";
import { privateStorage } from "@/lib/storage";
import { processVisitPhoto } from "@/lib/visits/photo";

const text=(v:FormDataEntryValue|null,max:number)=>String(v??"").trim().slice(0,max);
const order=(v:FormDataEntryValue|null)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):0};
const rating=(v:FormDataEntryValue|null)=>Math.min(5,Math.max(1,order(v)||5));
const refresh=()=>{revalidatePath("/admin/testimonials");revalidatePath("/")};
const imageKey=(id:string)=>`public/testimonials/${id}/portrait.webp`;
async function storeImage(id:string,file:FormDataEntryValue|null){if(!(file instanceof File)||file.size===0)return null;const processed=await processVisitPhoto(file);const key=imageKey(id);await privateStorage().put(key,processed.main);return key;}

export async function createTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const customerName=text(formData.get("customerName"),160);const quote=text(formData.get("quote"),2000);if(!customerName||!quote)throw new Error("Customer name and testimonial are required.");const item=await db.publicTestimonial.create({data:{customerName,customerRole:text(formData.get("customerRole"),200)||null,companyName:text(formData.get("companyName"),200)||null,quote,rating:rating(formData.get("rating")),displayOrder:order(formData.get("displayOrder")),isPublished:formData.get("isPublished")==="on"}});try{const key=await storeImage(item.id,formData.get("image"));if(key)await db.publicTestimonial.update({where:{id:item.id},data:{imagePath:key}})}catch(error){await db.publicTestimonial.delete({where:{id:item.id}}).catch(()=>undefined);throw error}refresh()}
export async function updateTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const id=text(formData.get("id"),80);const customerName=text(formData.get("customerName"),160);const quote=text(formData.get("quote"),2000);if(!id||!customerName||!quote)throw new Error("Invalid testimonial.");const existing=await db.publicTestimonial.findUnique({where:{id}});if(!existing)throw new Error("Invalid testimonial.");const key=await storeImage(id,formData.get("image"));await db.publicTestimonial.update({where:{id},data:{customerName,customerRole:text(formData.get("customerRole"),200)||null,companyName:text(formData.get("companyName"),200)||null,imagePath:key??existing.imagePath,quote,rating:rating(formData.get("rating")),displayOrder:order(formData.get("displayOrder")),isPublished:formData.get("isPublished")==="on"}});refresh()}
export async function deleteTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const id=text(formData.get("id"),80);if(!id)return;const existing=await db.publicTestimonial.findUnique({where:{id}});await db.publicTestimonial.delete({where:{id}});if(existing?.imagePath?.startsWith("public/testimonials/"))await privateStorage().delete(existing.imagePath).catch(()=>undefined);refresh()}
