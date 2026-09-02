import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { assignCustomerSchema, createCustomerSchema, editCustomerSchema, type CreateCustomerInput, type EditCustomerInput } from "./validation";

async function requireCompanyViewer() {
  const user = await requireRole("COMPANY_ADMIN", "MANAGER", "SALES");
  if (!user.companyId) throw new Error("NOT_AUTHORIZED");
  return { ...user, companyId: user.companyId };
}

export async function searchCustomers(query = "") {
  const user = await requireCompanyViewer();
  return searchCustomersForCompany(user.companyId,query,user.role==="COMPANY_ADMIN"?undefined:user.id);
}
export async function searchCustomersForCompany(companyId:string,query="",assignedUserId?:string) {
  const term = query.trim().slice(0, 100);
  return db.customer.findMany({ where: { companyId,assignedUserId, ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { contactPerson: { contains: term, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, take: 100 });
}
export async function assignCustomer(raw:unknown){const admin=await requireRole("COMPANY_ADMIN");if(!admin.companyId)throw new Error("NOT_AUTHORIZED");const companyId=admin.companyId;const d=assignCustomerSchema.parse(raw);return db.$transaction(async tx=>{const assignee=await tx.user.findFirst({where:{id:d.assignedUserId,companyId,isActive:true,role:{in:["MANAGER","SALES"]}},select:{id:true}});if(!assignee)throw new Error("INVALID_ASSIGNMENT");const changed=await tx.customer.updateMany({where:{id:d.customerId,companyId},data:{assignedUserId:assignee.id}});if(changed.count!==1)throw new Error("CUSTOMER_NOT_FOUND");});}

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
  const updated = await db.customer.updateMany({ where: { id: customerId, companyId: admin.companyId }, data: { ...data, phone: data.phone ?? null, email: data.email ?? null, contactPerson: data.contactPerson ?? null } });
  if (updated.count !== 1) throw new Error("CUSTOMER_NOT_FOUND");
}
