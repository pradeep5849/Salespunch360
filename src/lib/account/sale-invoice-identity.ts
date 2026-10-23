import type {Prisma} from "@prisma/client";
type Reader=Pick<Prisma.TransactionClient,"accountOperationalAudit">;
type Invoice={id:string;companyId:string;branchId:string;type:string;documentNumber:string};
/** Caller must supply a document already authorized for this company and branch.
 * Printed identity is an immutable correction snapshot, not a renamed ledger number. */
export async function saleInvoiceIdentity(tx:Reader,invoice:Invoice){
 const original={printedNumber:invoice.documentNumber,revision:0,previousInvoiceId:null as string|null};
 if(invoice.type!=="SALES_INVOICE")return original;
 const event=await tx.accountOperationalAudit.findFirst({where:{companyId:invoice.companyId,entityType:"SALES_INVOICE",entityId:invoice.id,eventType:"SALE_INVOICE_IDENTITY"},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{metadata:true}});
 if(!event)return original;
 return saleInvoiceIdentityFromMetadata(invoice,event.metadata);
}
export function saleInvoiceIdentityFromMetadata(invoice:Invoice,value:unknown){
 const original={printedNumber:invoice.documentNumber,revision:0,previousInvoiceId:null as string|null};
 if(value===null||value===undefined)return original;
 const metadata=value as Record<string,unknown>;
 if(typeof metadata!=="object"||Array.isArray(metadata)||metadata.branchId!==invoice.branchId||typeof metadata.printedNumber!=="string"||!metadata.printedNumber.trim()||metadata.printedNumber.length>100||!Number.isSafeInteger(metadata.revision)||Number(metadata.revision)<1||typeof metadata.previousInvoiceId!=="string"||!metadata.previousInvoiceId)throw new Error("SALE_INVOICE_IDENTITY_INVALID");
 return{printedNumber:metadata.printedNumber,revision:Number(metadata.revision),previousInvoiceId:metadata.previousInvoiceId};
}
export async function recordSaleInvoiceIdentity(tx:Reader,actorId:string,source:Invoice,replacement:Invoice){
 if(source.companyId!==replacement.companyId||source.branchId!==replacement.branchId||source.type!=="SALES_INVOICE"||replacement.type!=="SALES_INVOICE"||source.id===replacement.id)throw new Error("SALE_INVOICE_IDENTITY_INVALID");
 const before=await saleInvoiceIdentity(tx,source);
 if(before.revision>=2147483646)throw new Error("SALE_INVOICE_IDENTITY_INVALID");
 const identity={printedNumber:before.printedNumber,revision:before.revision+1,previousInvoiceId:source.id,branchId:source.branchId,internalDocumentNumber:replacement.documentNumber};
 await tx.accountOperationalAudit.create({data:{companyId:source.companyId,actorUserId:actorId,eventType:"SALE_INVOICE_IDENTITY",entityType:"SALES_INVOICE",entityId:replacement.id,metadata:identity}});
 return identity;
}
