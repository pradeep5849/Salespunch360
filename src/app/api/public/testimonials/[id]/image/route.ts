import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { privateStorage } from "@/lib/storage";

export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const item=await db.publicTestimonial.findFirst({where:{id,isPublished:true},select:{imagePath:true}});
  if(!item?.imagePath?.startsWith(`public/testimonials/${id}/`))return new NextResponse(null,{status:404});
  try{
    const image=await privateStorage().get(item.imagePath);
    return new NextResponse(new Uint8Array(image),{headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=3600, stale-while-revalidate=86400","X-Content-Type-Options":"nosniff"}});
  }catch{return new NextResponse(null,{status:404})}
}
