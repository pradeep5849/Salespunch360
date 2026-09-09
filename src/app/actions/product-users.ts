"use server";
import { revalidatePath } from "next/cache";
import { createAccountUser, createProductUser, editAccountUser, editProductUser } from "@/lib/users/product-user-management";

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
      ADDITIONAL_ADMIN_DEDICATED_FLOW: "Additional Sales Admins can only be managed by the Primary Admin in the dedicated Administrators section.",
      SALES_ROLE_CHANGE_NOT_ALLOWED: "Sales roles cannot be converted in the generic user editor.", SALES_ADMIN_ALL_BRANCHES_REQUIRED: "Sales Administrators must have access to all Branches.",
      MANAGERS_DISABLED: "Managers and Manager assignments are disabled by this Company's team structure.", EMAIL_VERIFICATION_REQUIRED: "Verify your email before creating users.", COMPANY_PROFILE_REQUIRED: "Complete the Company profile before creating users.", MANAGER_TYPE_CONFLICT: "Resolve this Field Manager's open field work and assignments before changing to Manager Only.",
    };
    return { error: messages[code] ?? "Unable to save this user. Review the role, manager, and Branch selections." };
  }
}

export async function manageAccountUser(_: ProductUserState, form: FormData): Promise<ProductUserState> {
  try {
    const operation = String(form.get("operation"));
    if (operation === "create-account") await createAccountUser({ name:form.get("name"),email:form.get("email"),password:form.get("password"),confirmPassword:form.get("confirmPassword"),accountRole:form.get("accountRole") });
    else if (operation === "edit-account") await editAccountUser({ userId:form.get("userId"),accountRole:form.get("accountRole"),accountAccessActive:form.get("accountAccessActive")==="on" });
    else return { error: "Invalid Account user operation." };
    revalidatePath("/workspace/employees");
    return { success: operation === "create-account" ? "Account user created." : "Account role updated; stale sessions were revoked." };
  } catch (error) { const code=error instanceof Error?error.message:""; const messages:Record<string,string>={ROLE_REQUIRED:"A user must retain at least one workspace role.",PRIMARY_PROTECTED:"The Primary Admin can only be changed through the dedicated ownership transfer flow.",IDENTITY_INACTIVE:"Account access cannot be activated while the identity is inactive."};return {error:messages[code]??"Unable to update Account access."}; }
}
