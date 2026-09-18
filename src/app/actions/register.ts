"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";
import { registerCompany } from "@/lib/auth/registration";
import {assertTrustedOrigin,consumeRateLimit,requestFingerprint} from "@/lib/security/request";
import { registrationSchema } from "@/lib/auth/validation";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { processCompanyLogo } from "@/lib/company/logo";

export type RegistrationState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function register(_: RegistrationState, formData: FormData): Promise<RegistrationState> {
  await assertTrustedOrigin();
  if (!await consumeRateLimit(await requestFingerprint("registration"),5,15*60_000) || formData.get("website")) {
    return { error: "Unable to create your account. Please wait and try again." };
  }

  if (formData.get("legalConsent") !== "accepted") {
    return { error: "You must agree to the Terms of Service and acknowledge the Privacy Policy.", fieldErrors: { legalConsent: ["Required before registration."] } };
  }

  const input = {
    productEdition: formData.get("productEdition"),
    companyName: formData.get("companyName"),
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
    const file=formData.get("companyLogo");
    const logo=file instanceof File&&file.size?await processCompanyLogo(file):undefined;
    const { user } = await registerCompany(parsed.data,logo);
    try { await issueEmailVerification(user.id, user.email); } catch { /* Account remains usable; authenticated resend is available. */ }
    await createSession(user.id);
  } catch (error) {
    return { error: error instanceof Error&&error.message==="LOGO_INVALID" ? "Company logo must be a valid JPEG, PNG, or WebP image up to 5 MB." : "Unable to create your account. Check your details or try again later." };
  }
  redirect(parsed.data.productEdition==="SALESPUNCH360_ACCOUNT"?"/workspace/account":"/workspace");
}
