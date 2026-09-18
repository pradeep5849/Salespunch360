"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";

const text=(v:FormDataEntryValue|null,max:number)=>String(v??"").trim().slice(0,max);
const order=(v:FormDataEntryValue|null)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):0};
const rating=(v:FormDataEntryValue|null)=>Math.min(5,Math.max(1,order(v)||5));
const refresh=()=>{revalidatePath("/admin/testimonials");revalidatePath("/")};

export async function createTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const customerName=text(formData.get("customerName"),160);const quote=text(formData.get("quote"),2000);if(!customerName||!quote)throw new Error("Customer name and testimonial are required.");await db.publicTestimonial.create({data:{customerName,customerRole:text(formData.get("customerRole"),200)||null,companyName:text(formData.get("companyName"),200)||null,quote,rating:rating(formData.get("rating")),displayOrder:order(formData.get("displayOrder")),isPublished:formData.get("isPublished")==="on"}});refresh()}
export async function updateTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const id=text(formData.get("id"),80);const customerName=text(formData.get("customerName"),160);const quote=text(formData.get("quote"),2000);if(!id||!customerName||!quote)throw new Error("Invalid testimonial.");await db.publicTestimonial.update({where:{id},data:{customerName,customerRole:text(formData.get("customerRole"),200)||null,companyName:text(formData.get("companyName"),200)||null,quote,rating:rating(formData.get("rating")),displayOrder:order(formData.get("displayOrder")),isPublished:formData.get("isPublished")==="on"}});refresh()}
export async function deleteTestimonialAction(formData:FormData){await requireGlobalSuperAdmin();const id=text(formData.get("id"),80);if(id)await db.publicTestimonial.delete({where:{id}});refresh()}
