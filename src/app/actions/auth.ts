"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, revokeCurrentSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/crypto";
import { loginSchema } from "@/lib/auth/validation";
import { canAuthenticate } from "@/lib/auth/eligibility";
import {assertTrustedOrigin,consumeRateLimit,requestFingerprint} from "@/lib/security/request";

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
  await createSession(user.id, formData.get("remember") === "true");
  redirect("/workspace");
}

export async function signOut() {
  await revokeCurrentSession();
  redirect("/sign-in");
}
