import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {env} from "@/lib/env";

const claimsSchema=z.object({companyId:z.string().guid(),branchId:z.string().guid(),id:z.string().guid(),version:z.string().datetime(),expires:z.number().int()}).strict();
type InvoiceIdentity={companyId:string;branchId:string;id:string;updatedAt:Date};
const signature=(payload:string)=>createHmac("sha256",env.AUTH_SECRET).update(`invoice-share:v1:${payload}`).digest();

// Called only after the invoice has been loaded through an authorized reader.
export function invoiceShareUrl(invoice:InvoiceIdentity,now=new Date()){
 const payload=Buffer.from(JSON.stringify({companyId:invoice.companyId,branchId:invoice.branchId,id:invoice.id,version:invoice.updatedAt.toISOString(),expires:now.getTime()+30*24*60*60*1000})).toString("base64url");
 const token=`${payload}.${signature(payload).toString("base64url")}`;
 return new URL(`/shared/invoice/${token}`,env.APP_URL).toString();
}

export function verifyInvoiceShareToken(token:string,now=new Date()){
 if(token.length>1024)return null;
 const parts=token.split(".");if(parts.length!==2)return null;
 const [payload,encoded]=parts,actual=Buffer.from(encoded,"base64url"),expected=signature(payload);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 try{const result=claimsSchema.safeParse(JSON.parse(Buffer.from(payload,"base64url").toString("utf8")));return result.success&&result.data.expires>now.getTime()?result.data:null}catch{return null}
}
