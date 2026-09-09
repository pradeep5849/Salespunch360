"use server";
import { redirect } from "next/navigation";
import { permanentlyDeleteCompany } from "@/lib/admin/permanent-company-delete";
import { AuthorizationError, AuthenticationError } from "@/lib/auth/authorization";
import { CleanupDatabaseError } from "@/lib/tenant-cleanup-database";
export async function permanentlyDeleteCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? ""), confirmation = String(formData.get("confirmation") ?? "");
  try { await permanentlyDeleteCompany(companyId, confirmation); }
  catch (error) {
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) throw error;
    const diagnostic = error instanceof CleanupDatabaseError
      ? { companyId, stage: error.stage, ...error.details }
      : { companyId, stage: "UNKNOWN" };
    console.error("Permanent Company deletion failed", diagnostic);
    const code = error instanceof Error && error.message === "PERMANENT_DELETE_CONFIRMATION_INCORRECT" ? "confirmation" : "blocked";
    redirect(`/admin/companies/${encodeURIComponent(companyId)}?prepare=1&error=${code}`);
  }
  redirect("/admin/companies?deleted=1");
}
