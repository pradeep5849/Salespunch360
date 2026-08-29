import { db } from "@/lib/db";
import { provisionInitialSuperAdmin } from "@/lib/auth/initial-super-admin";

async function main() {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;
  if (!process.env.DATABASE_URL || !email || !password) {
    throw new Error("Required provisioning secrets are unavailable.");
  }

  const result = await provisionInitialSuperAdmin(db, { email, password });
  console.log(result === "created" ? "Initial Super Admin created." : "Initial Super Admin already provisioned; no changes made.");
}

main()
  .catch(() => {
    console.error("Initial Super Admin provisioning failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
