import { db } from "@/lib/db";
import { hashPassword } from "./crypto";
import { registrationSchema, type RegistrationInput } from "./validation";
import { calculateTrialEndsAt } from "@/lib/trial/status";
import { randomUUID } from "node:crypto";

export function generateCompanySlug(companyName: string) {
  const base = companyName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "company";
  return `${base}-${randomUUID().replaceAll("-", "")}`;
}

export async function registerCompany(input: RegistrationInput) {
  const data = registrationSchema.parse(input);
  return db.$transaction(async (tx) => {
    const duplicateEmail = await tx.user.findUnique({ where: { email: data.adminEmail }, select: { id: true } });
    if (duplicateEmail) throw new Error("REGISTRATION_CONFLICT");

    const trialStartedAt = new Date();
    const trialEndsAt = calculateTrialEndsAt(trialStartedAt);
    const passwordHash = await hashPassword(data.adminPassword);
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug: generateCompanySlug(data.companyName),
        teamStructure: data.teamStructure,
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
