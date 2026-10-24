import {requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {mutationGuard} from "@/lib/security/request";
import {downloadQuotationAttachmentForActor,removeQuotationAttachmentForActor} from "@/lib/quotations/attachments";
import {attachmentJson,quotationAttachmentFailure,quotationAttachmentResponse} from "@/lib/quotations/attachment-http";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,c:Context){try{return quotationAttachmentResponse(await downloadQuotationAttachmentForActor(await requirePermission("ACCOUNT_QUOTATION_VIEW"),(await c.params).id))}catch(e){return quotationAttachmentFailure(e)}}
export async function DELETE(r:Request,c:Context){try{const actor=await requirePermissionForMutation("ACCOUNT_QUOTATION_EDIT");await mutationGuard("quotation-attachments");const q=new URL(r.url).searchParams;await removeQuotationAttachmentForActor(actor,q.get("documentId")??"",Number(q.get("revisionNumber")??NaN),(await c.params).id);return attachmentJson({removed:true})}catch(e){return quotationAttachmentFailure(e)}}
