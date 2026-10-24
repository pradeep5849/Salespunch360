import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileQuotationAttachmentList,mobileQuotationAttachmentUpload} from "@/lib/mobile/account-quotations";
import {attachmentJson,quotationAttachmentFailure,quotationAttachmentForm} from "@/lib/quotations/attachment-http";
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){try{return attachmentJson(await mobileQuotationAttachmentList(await authenticateMobileToken(r.headers.get("authorization")),(await c.params).id,Number(new URL(r.url).searchParams.get("revisionNumber")??NaN)))}catch(e){return quotationAttachmentFailure(e)}}
export async function POST(r:Request,c:Context){try{const user=await authenticateMobileToken(r.headers.get("authorization")),form=await quotationAttachmentForm(r);return attachmentJson(await mobileQuotationAttachmentUpload(user,(await c.params).id,form.revisionNumber,form.requestKey,form.file),201)}catch(e){return quotationAttachmentFailure(e)}}
