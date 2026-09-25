"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, revokeCurrentSession } from "@/lib/auth/session";
import { replacePasswordAndRevoke } from "@/lib/auth/session-generation";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { loginSchema, strongPasswordSchema } from "@/lib/auth/validation";
import { requireUser } from "@/lib/auth/authorization";
import { canAuthenticate } from "@/lib/auth/eligibility";
import {canUseWebLogin} from "@/lib/auth/workspace-policy";
import {assertTrustedOrigin,consumeRateLimit,requestFingerprint} from "@/lib/security/request";
import {authenticatedHome} from "@/lib/auth/routing";
import { cookies } from "next/headers";

export type SignInState = { error?: string };

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  await assertTrustedOrigin();
  const identity=String(formData.get("email")||"");
  if(!await consumeRateLimit(await requestFingerprint("sign-in",identity),10,15*60_000))return {error:"Invalid email or password."};
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Invalid email or password." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!canAuthenticate(user) || !user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Invalid email or password." };
  }
  if (user.role === "SUPER_ADMIN" && user.companyId !== null) {
    return { error: "Invalid email or password." };
  }
  if(user.role!=="SUPER_ADMIN"&&!canUseWebLogin(user)){
    return {error:"This account can sign in only in the SalesPunch360 mobile app."};
  }
  await createSession(user.id, formData.get("remember") === "true", user.passwordHash);
  if(user.role==="SUPER_ADMIN")return redirect("/admin");
  // Older test/integration adapters may expose only the User delegate.
  if(!user.companyId||!(db as {company?:unknown}).company)return redirect(authenticatedHome(user));
  const company=user.companyId?await db.company.findUnique({where:{id:user.companyId},select:{productEdition:true}}):null;
  const preferred=(await cookies()).get("sp360_web_workspace")?.value;
  redirect(authenticatedHome(user,company?.productEdition,preferred));
}

export async function signOut() {
  await revokeCurrentSession();
  redirect("/sign-in");
}

export type ChangePasswordState={error?:string;success?:string};
export async function changePassword(_:ChangePasswordState,formData:FormData):Promise<ChangePasswordState>{
  await assertTrustedOrigin();
  const actor=await requireUser(),current=String(formData.get("currentPassword")||""),next=String(formData.get("newPassword")||""),confirmation=String(formData.get("confirmPassword")||"");
  if(next!==confirmation)return{error:"New password and confirmation do not match."};
  const valid=strongPasswordSchema.safeParse(next);if(!valid.success)return{error:valid.error.issues[0]?.message||"New password does not meet the password policy."};
  const user=await db.user.findUnique({where:{id:actor.id},select:{passwordHash:true}});
  if(!user||!await verifyPassword(user.passwordHash,current))return{error:"Current password is incorrect."};
  if(await verifyPassword(user.passwordHash,next))return{error:"New password must be different from the current password."};
  await replacePasswordAndRevoke(actor.id,await hashPassword(next),user.passwordHash);
  return{success:"Password changed. Sign in again with your new password."};
}
