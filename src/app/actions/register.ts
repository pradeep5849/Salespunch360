"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";
import { registerCompany } from "@/lib/auth/registration";
import { allowRegistrationAttempt } from "@/lib/auth/registration-rate-limit";
import { registrationSchema } from "@/lib/auth/validation";

export type RegistrationState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function register(_: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const requestHeaders = await headers();
  const source = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRegistrationAttempt(source) || formData.get("website")) {
    return { error: "Unable to create your account. Please wait and try again." };
  }

  const input = {
    companyName: formData.get("companyName"),
    companySlug: formData.get("companySlug"),
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
