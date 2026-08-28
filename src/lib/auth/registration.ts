import { db } from "@/lib/db";
import { hashPassword } from "./crypto";
import { registrationSchema, type RegistrationInput } from "./validation";

export async function registerCompany(input: RegistrationInput) {
  const data = registrationSchema.parse(input);
  const passwordHash = await hashPassword(data.adminPassword);
  return db.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: data.companyName, slug: data.companySlug } });
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
