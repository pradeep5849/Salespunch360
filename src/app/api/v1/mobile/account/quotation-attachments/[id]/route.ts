import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileQuotationAttachmentDownload,mobileQuotationAttachmentRemove} from "@/lib/mobile/account-quotations";
import {attachmentJson,quotationAttachmentFailure,quotationAttachmentResponse} from "@/lib/quotations/attachment-http";
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){try{return quotationAttachmentResponse(await mobileQuotationAttachmentDownload(await authenticateMobileToken(r.headers.get("authorization")),(await c.params).id))}catch(e){return quotationAttachmentFailure(e)}}
export async function DELETE(r:Request,c:Context){try{const q=new URL(r.url).searchParams;await mobileQuotationAttachmentRemove(await authenticateMobileToken(r.headers.get("authorization")),q.get("documentId")??"",Number(q.get("revisionNumber")??NaN),(await c.params).id);return attachmentJson({removed:true})}catch(e){return quotationAttachmentFailure(e)}}
