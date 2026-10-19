import {requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {listQuotationAttachmentsForActor,uploadQuotationAttachmentForActor} from "@/lib/quotations/attachments";
import {attachmentJson,quotationAttachmentFailure,quotationAttachmentForm} from "@/lib/quotations/attachment-http";
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){try{return attachmentJson(await listQuotationAttachmentsForActor(await requirePermission("ACCOUNT_QUOTATION_VIEW"),(await c.params).id,Number(new URL(r.url).searchParams.get("revisionNumber")??NaN)))}catch(e){return quotationAttachmentFailure(e)}}
export async function POST(r:Request,c:Context){try{const actor=await requirePermissionForMutation("ACCOUNT_QUOTATION_EDIT");await mutationGuard("quotation-attachments");const form=await quotationAttachmentForm(r);return attachmentJson(await uploadQuotationAttachmentForActor(actor,{documentId:(await c.params).id,revisionNumber:form.revisionNumber,requestKey:form.requestKey},form.file),201)}catch(e){return quotationAttachmentFailure(e)}}
