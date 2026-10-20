import {Prisma} from "@prisma/client";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "@/lib/account/modules";
import type {ProjectActor} from "@/lib/account/projects";

type ConversionTarget={id?:string;sourceQuotationRevisionId?:string|null;type:string;branchId:string;partyId:string;projectId?:string|null};
/** Rechecked under the source lock at actual target creation and posting. */
export async function authorizeQuotationConversion(actor:ProjectActor,target:Pick<ConversionTarget,"sourceQuotationRevisionId"|"type">){
 if(!target.sourceQuotationRevisionId)return;
 if(!actor.companyId||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_QUOTATION_VIEW")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SALES_ENTRY")||(target.type==="SALES_INVOICE"&&!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST")))throw new AuthorizationError();
 if(!["SALES_INVOICE","SALES_ORDER"].includes(target.type))throw new Error("INVALID_QUOTATION_CONVERSION_TARGET");
 await requireAccountModules(actor,"QUOTATIONS_BOQ","SALES",...(target.type==="SALES_ORDER"?["SALES_ORDER" as const]:[]));
 }
export async function requireQuotationSourceInTx(tx:Prisma.TransactionClient,actor:ProjectActor,target:ConversionTarget){
 if(!target.sourceQuotationRevisionId)return null;
 await authorizeQuotationConversion(actor,target);
 await tx.$queryRaw`SELECT q.id FROM quotation_documents q JOIN quotation_revisions r ON r."documentId"=q.id AND r."companyId"=q."companyId" WHERE r.id=${target.sourceQuotationRevisionId}::uuid AND q."companyId"=${actor.companyId}::uuid FOR UPDATE OF q`;
 const revision=await tx.quotationRevision.findFirst({where:{id:target.sourceQuotationRevisionId,companyId:actor.companyId},include:{document:true}});
 if(!revision)throw new Error("INVALID_QUOTATION_CONVERSION_SOURCE");
 const source=revision.document;
 if(actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(source.branchId))throw new AuthorizationError();
 if(source.branchId!==target.branchId||source.customerId!==target.partyId||(source.projectId??null)!==(target.projectId??null))throw new Error("INVALID_QUOTATION_CONVERSION_SOURCE");
 if(source.convertedCommercialDocumentId)throw new Error("QUOTATION_ALREADY_CONVERTED");
 if(revision.revisionNumber!==source.currentRevisionNumber)throw new Error("QUOTATION_REVISION_CHANGED");
 if(source.status!=="APPROVED"||revision.status!=="APPROVED")throw new Error("QUOTATION_APPROVAL_REQUIRED");
 return revision;
}

/** Must follow the target's successful POSTED update in the same transaction. */
export async function closeQuotationSourceInTx(tx:Prisma.TransactionClient,actor:ProjectActor,target:ConversionTarget&{id:string}){
 const revision=await requireQuotationSourceInTx(tx,actor,target);if(!revision)return;
 const changed=await tx.quotationDocument.updateMany({where:{id:revision.documentId,companyId:actor.companyId!,currentRevisionNumber:revision.revisionNumber,status:"APPROVED",convertedCommercialDocumentId:null},data:{convertedCommercialDocumentId:target.id,convertedAt:new Date()}});
 if(changed.count!==1)throw new Error("QUOTATION_ALREADY_CONVERTED");
 await tx.quotationAuditEvent.create({data:{companyId:actor.companyId!,documentId:revision.documentId,actorId:actor.id,eventType:"CONVERTED",revisionNumber:revision.revisionNumber,note:`Converted to ${target.type} ${target.id}`}});
}
