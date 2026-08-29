"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";
import { registerCompany } from "@/lib/auth/registration";
import {assertTrustedOrigin,consumeRateLimit,requestFingerprint} from "@/lib/security/request";
import { registrationSchema } from "@/lib/auth/validation";

export type RegistrationState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function register(_: RegistrationState, formData: FormData): Promise<RegistrationState> {
  await assertTrustedOrigin();
  if (!await consumeRateLimit(await requestFingerprint("registration"),5,15*60_000) || formData.get("website")) {
    return { error: "Unable to create your account. Please wait and try again." };
  }

  const input = {
    companyName: formData.get("companyName"),
    teamStructure: formData.get("teamStructure"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    adminPassword: formData.get("adminPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please review the highlighted information.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { user } = await registerCompany(parsed.data);
    await createSession(user.id);
  } catch {
    return { error: "Unable to create your account. Check your details or try again later." };
  }
  redirect("/workspace");
}
