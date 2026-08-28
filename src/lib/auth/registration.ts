import { db } from "@/lib/db";
import { hashPassword } from "./crypto";
import { registrationSchema, type RegistrationInput } from "./validation";
import { calculateTrialEndsAt } from "@/lib/trial/status";

export async function registerCompany(input: RegistrationInput) {
  const data = registrationSchema.parse(input);
  return db.$transaction(async (tx) => {
    const duplicate = await tx.company.findUnique({ where: { slug: data.companySlug }, select: { id: true } });
    const duplicateEmail = await tx.user.findUnique({ where: { email: data.adminEmail }, select: { id: true } });
    if (duplicate || duplicateEmail) throw new Error("REGISTRATION_CONFLICT");

    const trialStartedAt = new Date();
    const trialEndsAt = calculateTrialEndsAt(trialStartedAt);
    const passwordHash = await hashPassword(data.adminPassword);
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug: data.companySlug,
        subscriptionStatus: "TRIAL",
        trialStartedAt,
        trialEndsAt,
      },
    });
    const user = await tx.user.create({
      data: {
        name: data.adminName,
        email: data.adminEmail,
        passwordHash,
        role: "COMPANY_ADMIN",
        companyId: company.id,
      },
      select: { id: true, name: true, email: true, role: true, companyId: true },
    });
    return { company, user };
  });
}
