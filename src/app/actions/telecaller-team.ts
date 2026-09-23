"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mutationGuard } from "@/lib/security/request";
import { createTelecallerEmployee, setTelecallerActive } from "@/lib/telecalling/team";

export async function createTelecallerEmployeeAction(form: FormData) {
  await mutationGuard("telecaller-employee-create", 10);
  try {
    await createTelecallerEmployee({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      employeeCode: form.get("employeeCode"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TELECALLER_CREATE_FAILED";
    redirect(`/workspace/employees/sales/new/telecaller?error=${encodeURIComponent(code)}`);
  }
  revalidatePath("/workspace/employees");
  revalidatePath("/workspace/billing/telecaller");
  redirect("/workspace/employees?filter=telecallers");
}

export async function setTelecallerActiveAction(form: FormData) {
  await mutationGuard("telecaller-employee-status", 20);
  const userId = String(form.get("userId") ?? "");
  const active = String(form.get("active") ?? "false") === "true";
  await setTelecallerActive(userId, active);
  revalidatePath("/workspace/employees");
  revalidatePath("/workspace/billing/telecaller");
}