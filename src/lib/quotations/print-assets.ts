import {db} from "@/lib/db";
import {privateStorage} from "@/lib/storage";
import sharp from "sharp";
export type QuotationPrintAssets={logoDataUrl?:string;signatureDataUrl?:string;authorizedSignatory?:string};
/** Called only after the quotation/share scope is authorized. Object keys stay private. */
export async function quotationPrintAssets(companyId:string):Promise<QuotationPrintAssets>{
 const [company,signature,settings]=await Promise.all([
  db.company.findUnique({where:{id:companyId},select:{logoObjectKey:true}}),
  db.authorizedSignatureVersion.findFirst({where:{companyId,isCurrent:true},orderBy:{createdAt:"desc"},select:{objectKey:true}}),
  db.accountSettings.findUnique({where:{companyId},select:{transactionDefaults:true,printProfile:true}}),
 ]);
 const defaults=settings?.transactionDefaults as {invoicePrintSettings?:{companyLogo?:boolean;signatureText?:boolean}}|null;
 const profile=settings?.printProfile as {authorizedSignatory?:unknown}|null;
 const assets:QuotationPrintAssets={};
 const image=async(key:string)=>{
  const bytes=await privateStorage().get(key);
  if(bytes.length>10*1024*1024)throw new Error("QUOTATION_PRINT_ASSET_TOO_LARGE");
  const png=await sharp(bytes,{limitInputPixels:10000000}).resize({width:600,height:200,fit:"inside",withoutEnlargement:true}).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
 };
 if(defaults?.invoicePrintSettings?.companyLogo!==false&&company?.logoObjectKey)assets.logoDataUrl=await image(company.logoObjectKey);
 if(defaults?.invoicePrintSettings?.signatureText!==false){
  if(signature)assets.signatureDataUrl=await image(signature.objectKey);
  if(typeof profile?.authorizedSignatory==="string")assets.authorizedSignatory=profile.authorizedSignatory;
 }
 return assets;
}
