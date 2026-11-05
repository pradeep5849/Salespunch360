import {exportAccountData} from "@/lib/account/exports";
import {validateExportRequest} from "@/lib/account/tabular-transfer";
export async function GET(request:Request,{params}:{params:Promise<{type:string}>}) {
 const {type}=await params,format=new URL(request.url).searchParams.get("format")??"csv";
 try {validateExportRequest(type,format);}catch{return Response.json({error:"Choose a supported export type and CSV or XLSX format."},{status:400});}
 try {
  const out=await exportAccountData(type,format);
  return new Response(out.bytes,{headers:{"content-type":out.contentType,"content-disposition":`attachment; filename="${type}.${format}"`,"cache-control":"private, no-store"}});
 }catch(error){if(error instanceof Error && error.message==="EXPORT_TOO_LARGE")return Response.json({error:"Export exceeds 100,000 rows. Contact support for a complete data export."},{status:413});throw error;}
}
