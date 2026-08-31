"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { issueEmailVerification, verifyEmailToken } from "@/lib/auth/email-verification";
import { assertTrustedOrigin, consumeRateLimit } from "@/lib/security/request";

export type VerificationActionState={status?:"success"|"error";message?:string};
export async function resendVerificationEmail(previous:VerificationActionState):Promise<VerificationActionState> {
  void previous;
  await assertTrustedOrigin();
  const actor = await requireRole("COMPANY_ADMIN");
  if (!await consumeRateLimit(`email-verification:${actor.id}`, 3, 60 * 60_000)) return {status:"success",message:"If verification is still needed, try again later."};
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true } });
  if (user && !user.emailVerifiedAt) {
    try { await issueEmailVerification(actor.id, user.email); }
    catch { return {status:"error",message:"We couldn't send the verification email. Your previous link remains valid; please try again."}; }
  }
  revalidatePath("/workspace");
  return {status:"success",message:"If verification is still needed, a new link has been sent."};
}

export async function confirmVerification(_:VerificationActionState,formData:FormData):Promise<VerificationActionState>{
  await assertTrustedOrigin();
  const token=String(formData.get("token")??"");
  return await verifyEmailToken(token)?{status:"success",message:"Email verified. You can continue to your workspace."}:{status:"error",message:"This verification link is invalid, expired, or already used."};
}
