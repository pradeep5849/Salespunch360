"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assignCustomer, createCustomer, editCustomer } from "@/lib/customers/service";
import { createCustomerSchema, editCustomerSchema } from "@/lib/customers/validation";

export async function assignCustomerAction(formData:FormData){await assignCustomer({customerId:formData.get("customerId"),assignedUserId:formData.get("assignedUserId")});revalidatePath("/workspace/customers");revalidatePath("/workspace/leads");}

export type CustomerActionState = { error?: string; success?: string };
export async function manageCustomer(_: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const fields = { name: formData.get("name"), contactPerson: formData.get("contactPerson"), phone: formData.get("phone"), email: formData.get("email") };
  try {
    if (formData.get("operation") === "create") { const parsed = createCustomerSchema.parse({name:fields.name,phone:fields.phone,assignedUserId:formData.get("assignedUserId"),branchId:formData.get("branchId")}); await createCustomer(parsed); }
    else { const parsed = editCustomerSchema.parse({ customerId: formData.get("customerId"), ...fields }); await editCustomer(parsed); }
  } catch(error) { const code=error instanceof Error?error.message:"";return { error: code==="BRANCH_REQUIRED"?"Choose a branch and try again.":"Unable to save this customer. Check the branch, assignment, and details." }; }
  revalidatePath("/workspace/customers");
  revalidatePath("/workspace/leads");
  return { success: "Customer saved." };
}

export async function createCustomerAction(formData:FormData){const parsed=createCustomerSchema.parse({name:formData.get("name"),phone:formData.get("phone"),assignedUserId:formData.get("assignedUserId"),branchId:formData.get("branchId")});await createCustomer(parsed);revalidatePath("/workspace/customers");revalidatePath("/workspace/leads");redirect("/workspace/customers");}
