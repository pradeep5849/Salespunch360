"use server";
import { redirect } from "next/navigation";
import { permanentlyDeleteCompany } from "@/lib/admin/permanent-company-delete";
import { AuthorizationError, AuthenticationError } from "@/lib/auth/authorization";
export async function permanentlyDeleteCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? ""), confirmation = String(formData.get("confirmation") ?? "");
  try { await permanentlyDeleteCompany(companyId, confirmation); }
  catch (error) {
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) throw error;
    console.error("Permanent Company deletion failed", { companyId, code: error instanceof Error ? error.message.split(":")[0] : "UNKNOWN" });
    const code = error instanceof Error && error.message === "PERMANENT_DELETE_CONFIRMATION_INCORRECT" ? "confirmation" : "blocked";
    redirect(`/admin/companies/${encodeURIComponent(companyId)}?prepare=1&error=${code}`);
  }
  redirect("/admin/billing?deleted=1");
}
