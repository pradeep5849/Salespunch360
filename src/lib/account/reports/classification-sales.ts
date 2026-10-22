import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import {reportUnitKey} from "./quantity";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const selection={id:true,lineType:true,productId:true,serviceId:true,itemName:true,unitName:true,unitSymbol:true,hsnSacCode:true,quantity:true,taxableAmount:true,cgstAmount:true,sgstAmount:true,igstAmount:true,cessAmount:true,lineTotal:true,document:{select:{type:true}}} as const satisfies Prisma.CommercialDocumentLineSelect;
type Line=Prisma.CommercialDocumentLineGetPayload<{select:typeof selection}>;
/** Immutable line snapshots, never current item classification or current tax rates. */
export async function classificationSalesReport(c:FinancialReportContext,services=false):Promise<ReportResult>{
 if(!c.actor.companyId)throw new AuthorizationError();
 const purchases=services&&c.f.classificationSide==="PURCHASES";
 await requireAccountModules(c.actor,purchases?"PURCHASES":"SALES","GST_ADVANCED");
 return db.$transaction(async tx=>{
  const groups=new Map<string,{line:Line;quantity:Prisma.Decimal;amounts:Prisma.Decimal[]}>();let cursor:string|undefined;
  for(;;){
   const lines=await tx.commercialDocumentLine.findMany({where:{companyId:c.actor.companyId,lineType:services?"SERVICE":"PRODUCT",document:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:purchases?["PURCHASE_BILL","DEBIT_NOTE"]:["SALES_INVOICE","CREDIT_NOTE"]}}},select:selection,orderBy:{id:"asc"},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){
    const key=JSON.stringify([line.productId??line.serviceId??line.id,line.itemName,line.hsnSacCode,reportUnitKey(line)]),sign=line.document.type==="CREDIT_NOTE"||line.document.type==="DEBIT_NOTE"?-1:1;
    const group=groups.get(key)??{line,quantity:new D(0),amounts:Array.from({length:6},()=>new D(0))};
    group.quantity=group.quantity.add(new D(line.quantity).mul(sign));
    [line.taxableAmount,line.cgstAmount,line.sgstAmount,line.igstAmount,line.cessAmount,line.lineTotal].forEach((value,index)=>{group.amounts[index]=group.amounts[index].add(new D(value).mul(sign))});groups.set(key,group);
   }
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  const entries=[...groups.entries()].sort(([ak,a],[bk,b])=>(a.line.hsnSacCode??"").localeCompare(b.line.hsnSacCode??"")||a.line.itemName.localeCompare(b.line.itemName)||ak.localeCompare(bk));
  const total=Array.from({length:6},(_,i)=>entries.reduce((sum,[,group])=>sum.add(group.amounts[i]),new D(0)));
  return{title:services?(purchases?"SAC Purchase Report":"SAC Sales Report"):"Sale Summary by HSN",columns:[services?"SAC":"HSN","Item","Quantity","Unit","Taxable","CGST","SGST","IGST","CESS","Amount"],rows:entries.map(([,g])=>[g.line.hsnSacCode??"Not recorded",g.line.itemName,g.quantity.toFixed(4),g.line.unitSymbol||g.line.unitName||"Unit unspecified",...g.amounts.map(v=>v.toFixed(2))]),totals:["Total","","—","",...total.map(v=>v.toFixed(2))],summary:[{label:"Item groups",value:String(entries.length),money:false},{label:"Taxable",value:total[0].toFixed(2),money:true},{label:purchases?"Purchase Amount":"Sale Amount",value:total[5].toFixed(2),money:true}],note:`${purchases?"Posted purchase bills net of debit notes":"Posted sales invoices net of credit notes"} for the selected company, authorized branches and period. Uses saved line names, classifications, invoice units, taxable amounts and GST components; missing codes remain Not recorded. Different item identities, names, codes and units remain separate; quantities are never added across units. Amount includes recorded line taxes; invoice-level charges and withholding are excluded. Custom/Work Package lines and ${purchases?"sales":"purchases"} are excluded. This is a ${purchases?"purchase":"sales"} analysis, not a statutory filing or stock movement report. No ledger changes.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
