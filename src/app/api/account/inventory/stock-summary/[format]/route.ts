import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import {inventorySnapshotForActor,listInventoryProductsForActor} from "@/lib/account/inventory";
import {exportExcel,exportPdf} from "@/lib/account/financial-reports";
import type {ProjectActor} from "@/lib/account/projects";

export async function GET(request:NextRequest,{params}:{params:Promise<{format:string}>}){
 const actor=await requirePermission("ACCOUNT_STOCK") as ProjectActor,{format}=await params,q=request.nextUrl.searchParams;
 if(format!=="pdf"&&format!=="xlsx")return NextResponse.json({error:"UNKNOWN_FORMAT"},{status:404});
 const rawDate=q.get("asOf"),asOf=rawDate&&/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?new Date(`${rawDate}T23:59:59.999Z`):undefined;
 const [products,snapshot,company]=await Promise.all([listInventoryProductsForActor(actor),inventorySnapshotForActor(actor,asOf),db.company.findUniqueOrThrow({where:{id:actor.companyId!},select:{name:true}})]);
 const totals=new Map<string,{quantity:number;value:number}>();for(const row of snapshot){const old=totals.get(row.productId)??{quantity:0,value:0};totals.set(row.productId,{quantity:old.quantity+Number(row.quantity),value:old.value+Number(row.stockValue)})}
 const search=(q.get("q")??"").toLowerCase(),category=q.get("category")??"",level=q.get("level")??"",status=q.get("status")??"";
 const rows=products.map(product=>({name:product.name,category:product.category?.name??"Uncategorised",active:product.isActive,threshold:Number(product.lowStockThreshold),...(totals.get(product.id)??{quantity:0,value:0})})).filter(row=>row.name.toLowerCase().includes(search)&&(!category||row.category===category)&&(!status||String(row.active)===status)&&(!level||(level==="negative"?row.quantity<0:level==="low"?row.quantity<=row.threshold:row.quantity>row.threshold))).map(row=>[row.name,row.category,row.quantity.toFixed(2),row.value.toFixed(2)]);
 const filter=q.toString()||"Current stock · no filters",input={title:"Stock Summary",company:company.name,filter,columns:["Item","Category","Stock quantity","Stock value"],rows};
 const bytes=format==="xlsx"?await exportExcel(input):exportPdf(input),contentType=format==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf";
 return new NextResponse(new Uint8Array(bytes),{headers:{"content-type":contentType,"content-disposition":`attachment; filename="stock-summary.${format}"`,"cache-control":"private, no-store"}})
}
