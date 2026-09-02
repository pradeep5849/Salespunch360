"use server";

import { revalidatePath } from "next/cache";
import { assignCustomer, createCustomer, editCustomer } from "@/lib/customers/service";
import { createCustomerSchema, editCustomerSchema } from "@/lib/customers/validation";

export async function assignCustomerAction(formData:FormData){await assignCustomer({customerId:formData.get("customerId"),assignedUserId:formData.get("assignedUserId")});revalidatePath("/workspace/customers");}

export type CustomerActionState = { error?: string; success?: string };
export async function manageCustomer(_: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const fields = { name: formData.get("name"), contactPerson: formData.get("contactPerson"), phone: formData.get("phone"), email: formData.get("email") };
  try {
    if (formData.get("operation") === "create") { const parsed = createCustomerSchema.parse({name:fields.name,phone:fields.phone}); await createCustomer(parsed); }
    else { const parsed = editCustomerSchema.parse({ customerId: formData.get("customerId"), ...fields }); await editCustomer(parsed); }
  } catch { return { error: "Unable to save this customer. Review the details and try again." }; }
  revalidatePath("/workspace/customers");
  return { success: "Customer saved." };
}
