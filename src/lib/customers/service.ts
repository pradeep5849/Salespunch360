import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { createCustomerSchema, editCustomerSchema, type CreateCustomerInput, type EditCustomerInput } from "./validation";

async function requireCompanyViewer() {
  const user = await requireRole("COMPANY_ADMIN", "MANAGER", "SALES");
  if (!user.companyId) throw new Error("NOT_AUTHORIZED");
  return { ...user, companyId: user.companyId };
}

export async function searchCustomers(query = "") {
  const { companyId } = await requireCompanyViewer();
  return searchCustomersForCompany(companyId,query);
}
export async function searchCustomersForCompany(companyId:string,query="") {
  const term = query.trim().slice(0, 100);
  return db.customer.findMany({ where: { companyId, ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { contactPerson: { contains: term, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, take: 100 });
}

export async function createCustomer(raw: CreateCustomerInput) {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new Error("NOT_AUTHORIZED");
  const data = createCustomerSchema.parse(raw);
  return db.customer.create({ data: { ...data, companyId: admin.companyId } });
}

export async function editCustomer(raw: EditCustomerInput) {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new Error("NOT_AUTHORIZED");
  const { customerId, ...data } = editCustomerSchema.parse(raw);
  const updated = await db.customer.updateMany({ where: { id: customerId, companyId: admin.companyId }, data: { ...data, phone: data.phone ?? null, email: data.email ?? null, contactPerson: data.contactPerson ?? null, address: data.address ?? null, latitude: data.latitude ?? null, longitude: data.longitude ?? null } });
  if (updated.count !== 1) throw new Error("CUSTOMER_NOT_FOUND");
}
