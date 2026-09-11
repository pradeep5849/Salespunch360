"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createManager, createSalesEmployee, deactivateEmployee, editEmployee,
  reactivateEmployee, resetEmployeePassword,
} from "@/lib/employees/service";
import {
  createManagerSchema, createSalesSchema, editEmployeeSchema,
  employeeIdSchema, resetEmployeePasswordSchema,
} from "@/lib/employees/validation";

export type EmployeeActionState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

const safeError = { error: "Unable to complete that employee operation. Check the details and try again." };

export async function manageEmployee(_: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const operation = formData.get("operation");
  try {
    if (operation === "create-manager" || operation === "create-sales") {
      const input = {
        name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"),
        employeeCode: formData.get("employeeCode"), designation:formData.get("designation"),dateOfJoining:formData.get("dateOfJoining"), password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
        ...(operation === "create-manager" ? { managerType: formData.get("managerType") } : { managerId: formData.get("managerId") }),
      };
      const schema = operation === "create-manager" ? createManagerSchema : createSalesSchema;
      const parsed = schema.safeParse(input);
      if (!parsed.success) return { error: "Review the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
      if (operation === "create-manager") await createManager(parsed.data);
      else await createSalesEmployee(parsed.data);
    } else if (operation === "edit") {
      const input = { employeeId: formData.get("employeeId"), name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"), employeeCode: formData.get("employeeCode"),designation:formData.get("designation"),dateOfJoining:formData.get("dateOfJoining"), managerId: formData.get("managerId"), managerType: formData.get("managerType") ?? undefined };
      const parsed = editEmployeeSchema.safeParse(input);
      if (!parsed.success) return { error: "Review the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
      await editEmployee(parsed.data);
    } else if (operation === "deactivate" || operation === "reactivate") {
      const parsed = employeeIdSchema.safeParse({ employeeId: formData.get("employeeId") });
      if (!parsed.success) return safeError;
      if (operation === "deactivate") await deactivateEmployee(parsed.data);
      else await reactivateEmployee(parsed.data);
    } else if (operation === "reset-password") {
      const parsed = resetEmployeePasswordSchema.safeParse({ employeeId: formData.get("employeeId"), password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
      if (!parsed.success) return { error: "Review the new password and confirmation.", fieldErrors: parsed.error.flatten().fieldErrors };
      await resetEmployeePassword(parsed.data);
    } else {
      return safeError;
    }
  } catch (error) {
    const code=error instanceof Error?error.message:"";
    if(code==="EMAIL_VERIFICATION_REQUIRED")return{error:"Verify your email to unlock employee creation."};
    if(code==="COMPANY_PROFILE_REQUIRED")return{error:"Complete your company profile to unlock employee creation."};
    if(code==="MANAGER_TYPE_CONFLICT")return{error:"Finish or reassign this Manager's open attendance, visit, active leads, pending follow-ups, assigned customers and active targets before changing to Manager Only."};
    if(code==="PHONE_IN_USE")return{error:"This mobile number is already in use in your company."};
    return safeError;
  }
  revalidatePath("/workspace/employees");
  if(formData.get("returnTo")==="/workspace/employees")redirect("/workspace/employees");
  return { success: operation === "reset-password" ? "Password updated and sessions revoked." : "Employee updated successfully." };
}

export async function manageEmployeeForm(formData:FormData){return manageEmployee({},formData)}
