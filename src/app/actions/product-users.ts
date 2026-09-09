"use server";
import { revalidatePath } from "next/cache";
import { createProductUser, editProductUser } from "@/lib/users/product-user-management";

export type ProductUserState = { error?: string; success?: string };
const values = (form: FormData) => ({
  name: form.get("name"), email: form.get("email"),
  salesRole: form.get("salesRole"), accountRole: form.get("accountRole"), managerType: form.get("managerType"), managerId: form.get("managerId"),
  branchAccessScope: form.get("branchAccessScope"), branchIds: form.getAll("branchIds").map(String),
});
export async function manageProductUser(_: ProductUserState, form: FormData): Promise<ProductUserState> {
  try {
    const operation = String(form.get("operation"));
    if (operation === "create") await createProductUser({ ...values(form), password: form.get("password"), confirmPassword: form.get("confirmPassword") });
    else if (operation === "edit") await editProductUser({ ...values(form), userId: form.get("userId"), salesAccessActive: form.get("salesAccessActive") === "on", accountAccessActive: form.get("accountAccessActive") === "on" });
    else return { error: "Invalid user operation." };
    revalidatePath("/workspace/employees");
    return { success: operation === "create" ? "User created." : "User roles and access updated; stale sessions were revoked." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string,string> = {
      PRIMARY_PROTECTED: "The Primary Admin can only be changed through Primary Admin transfer.", INVALID_BRANCH: "Select active branches belonging to this Company.",
      BRANCH_REQUIRED: "Select at least one Branch.", INVALID_MANAGER: "Select an active Manager from this Company.",
      SALES_ROLE_NOT_ENTITLED: "This product does not include Sales roles.", ACCOUNT_ROLE_NOT_ENTITLED: "This product does not include Account roles.",
      MANAGER_TYPE_REQUIRED: "Choose Field Manager or Manager Only.", MANAGER_TYPE_NOT_ALLOWED: "Manager type is only valid for a Manager.", ROLE_REQUIRED: "Choose at least one role.",
    };
    return { error: messages[code] ?? "Unable to save this user. Review the role, manager, and Branch selections." };
  }
}
