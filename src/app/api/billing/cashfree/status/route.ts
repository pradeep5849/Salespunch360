import { cashfreeConfig, CASHFREE_API_VERSION } from "@/lib/billing/cashfree-config";
export const dynamic="force-dynamic";
export function GET(){
 const headers={"Cache-Control":"no-store"};
 try{const config=cashfreeConfig();return Response.json({configured:true,environment:config.environment,apiVersion:CASHFREE_API_VERSION},{headers});}
 catch{return Response.json({configured:false,environment:"unavailable",apiVersion:CASHFREE_API_VERSION},{status:503,headers});}
}
