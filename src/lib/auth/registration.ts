import { db } from "@/lib/db";
import { hashPassword } from "./crypto";
import { registrationSchema, type RegistrationInput } from "./validation";
import { calculateTrialEndsAt } from "@/lib/trial/status";
import { randomUUID } from "node:crypto";
import { companyLogoKey } from "@/lib/company/logo";
import { privateStorage } from "@/lib/storage";
import { BusinessType } from "@prisma/client";
import { recommendedModulesForBusinessType } from "@/lib/account/modules";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";

export function generateCompanySlug(companyName: string) {
  const base = companyName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "company";
  return `${base}-${randomUUID().replaceAll("-", "")}`;
}

export async function registerCompany(input: RegistrationInput, logo?: Buffer) {
  const data = registrationSchema.parse(input);
  let writtenLogoKey: string | undefined;
  try { return await db.$transaction(async (tx) => {
    const duplicateEmail = await tx.user.findUnique({ where: { email: data.adminEmail }, select: { id: true } });
    if (duplicateEmail) throw new Error("REGISTRATION_CONFLICT");

    const trialStartedAt = new Date();
    const trialEndsAt = calculateTrialEndsAt(trialStartedAt);
    const passwordHash = await hashPassword(data.adminPassword);
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug: generateCompanySlug(data.companyName),
        productEdition: data.productEdition,
        enabledModules: data.productEdition === "SALESPUNCH360_ACCOUNT" ? [] : undefined,
        // Team structure is deliberately chosen during verified company setup.
        // The schema default is safe because employee creation remains blocked
        // until all required company details (including that explicit choice) save.
        subscriptionStatus: "TRIAL",
        trialStartedAt,
        trialEndsAt,
        primaryContactName: data.adminName,
        contactEmail: data.adminEmail,
        accountSettings: data.productEdition === "SALESPUNCH360" ? undefined : { create: { baseCurrency: "INR", businessType: BusinessType.OTHER_MIXED, enabledModules: recommendedModulesForBusinessType(BusinessType.OTHER_MIXED) } },
        ledgerAccounts: data.productEdition === "SALESPUNCH360" ? undefined : { create: DEFAULT_LEDGER_ACCOUNTS },
      },
    });
    await tx.branch.create({
      data: { name: "Head Office", code: "HO", isPrimary: true, isActive: true, companyId: company.id },
    });
    const user = await tx.user.create({
      data: {
        name: data.adminName,
        email: data.adminEmail,
        passwordHash,
        role: "COMPANY_ADMIN",
        salesRole: "PRIMARY_ADMIN",
        accountRole: data.productEdition === "SALESPUNCH360" ? null : "ACCOUNT_ADMIN",
        salesAccessActive: data.productEdition !== "SALESPUNCH360_ACCOUNT",
        accountAccessActive: data.productEdition !== "SALESPUNCH360",
        companyId: company.id,
      },
      select: { id: true, name: true, email: true, role: true, companyId: true },
    });
    if (logo) {
      writtenLogoKey = companyLogoKey(company.id);
      await privateStorage().put(writtenLogoKey, logo);
      await tx.company.update({ where: { id: company.id }, data: { logoObjectKey: writtenLogoKey } });
    }
    return { company, user };
  }); } catch (error) {
    if (writtenLogoKey) await privateStorage().delete(writtenLogoKey).catch(() => undefined);
    throw error;
  }
}
