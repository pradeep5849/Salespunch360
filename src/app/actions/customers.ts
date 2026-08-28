"use server";

import { revalidatePath } from "next/cache";
import { createCustomer, editCustomer } from "@/lib/customers/service";
import { createCustomerSchema, editCustomerSchema } from "@/lib/customers/validation";

export type CustomerActionState = { error?: string; success?: string };
export async function manageCustomer(_: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const fields = { name: formData.get("name"), contactPerson: formData.get("contactPerson"), phone: formData.get("phone"), email: formData.get("email"), address: formData.get("address"), latitude: formData.get("latitude"), longitude: formData.get("longitude") };
  try {
    if (formData.get("operation") === "create") { const parsed = createCustomerSchema.parse(fields); await createCustomer(parsed); }
    else { const parsed = editCustomerSchema.parse({ customerId: formData.get("customerId"), ...fields }); await editCustomer(parsed); }
  } catch { return { error: "Unable to save this customer. Review the details and try again." }; }
  revalidatePath("/workspace/customers");
  return { success: "Customer saved." };
}
