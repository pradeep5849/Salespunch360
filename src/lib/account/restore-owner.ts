import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
export async function isCompanyRestoreOwner(actor: {
  id: string;
  companyId: string;
  accountRole?: string | null;
}) {
  if (actor.accountRole !== "ACCOUNT_ADMIN") return false;
  return Boolean(
    await db.user.findFirst({
      where: {
        id: actor.id,
        companyId: actor.companyId,
        isActive: true,
        accountAccessActive: true,
        accountRole: "ACCOUNT_ADMIN",
        branchAccessScope: "ALL_BRANCHES",
        OR: [{ role: "COMPANY_ADMIN" }, { salesRole: "PRIMARY_ADMIN" }],
      },
      select: { id: true },
    }),
  );
}
export async function requireCompanyRestoreOwner(actor: {
  id: string;
  companyId: string;
  accountRole?: string | null;
}) {
  if (!(await isCompanyRestoreOwner(actor))) throw new AuthorizationError();
}
