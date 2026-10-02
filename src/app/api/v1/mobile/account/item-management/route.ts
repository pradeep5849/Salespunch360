import { authenticateMobileToken } from "@/lib/mobile/auth";
import { bulkSetMobileItemsActive, saveMobileUnitConversion } from "@/lib/mobile/account-master-data";
import { mobileAuthorizationFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";

export async function POST(request:Request){
 try{
  const user=await authenticateMobileToken(request.headers.get("authorization"));
  const body=await request.json() as {action?:string;kind?:"items"|"services";ids?:string[];isActive?:boolean;baseUnitId?:string;secondaryUnitId?:string;rate?:number|string};
  if(body.action==="SET_ACTIVE"){
   if(!body.kind||!Array.isArray(body.ids)||typeof body.isActive!=="boolean")return mobileJson({error:"INVALID_INPUT"},400);
   return mobileJson(await bulkSetMobileItemsActive(user,body.kind,body.ids,body.isActive));
  }
  if(body.action==="UNIT_CONVERSION"){
   return mobileJson(await saveMobileUnitConversion(user,{baseUnitId:body.baseUnitId,secondaryUnitId:body.secondaryUnitId,rate:body.rate}));
  }
  return mobileJson({error:"INVALID_INPUT"},400);
 }catch(e){
  return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_ITEM_MANAGEMENT",e);
 }
}
