import { requireUser } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { privateStorage } from "@/lib/storage";

export async function GET() {
  try {
    const user=await requireUser();
    if(!user.companyId)return new Response("Not found",{status:404});
    const company=await db.company.findUnique({where:{id:user.companyId},select:{logoObjectKey:true}});
    if(!company?.logoObjectKey)return new Response("Not found",{status:404});
    const data=await privateStorage().get(company.logoObjectKey);
    return new Response(new Uint8Array(data),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch { return new Response("Not found",{status:404}); }
}
