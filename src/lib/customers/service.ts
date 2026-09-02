import { Prisma } from "@prisma/client";
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
export async function searchCustomersForCompany(companyId:string,query="",assignedUserId?:string|null) {
  const term = query.trim().slice(0, 100);
  return db.customer.findMany({ where: { companyId,assignedUserId, ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { contactPerson: { contains: term, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, take: 100 });
}
async function createLeadForCustomer(tx:Prisma.TransactionClient,companyId:string,adminId:string,customer:{id:string;name:string;phone:string|null},assignedUserId:string){const existing=await tx.lead.findFirst({where:{companyId,customerId:customer.id},select:{id:true}});if(existing)return existing;const lead=await tx.lead.create({data:{companyId,customerId:customer.id,assignedUserId,createdByUserId:adminId,title:customer.name,contactName:customer.name,phone:customer.phone,source:"MANUAL",stage:"NEW"}});await tx.leadActivity.create({data:{companyId,leadId:lead.id,actorUserId:adminId,type:"CREATED",newAssignedUserId:assignedUserId,toStage:"NEW"}});return lead;}
export async function assignCustomer(raw:unknown){const admin=await requireRole("COMPANY_ADMIN");if(!admin.companyId)throw new Error("NOT_AUTHORIZED");const companyId=admin.companyId;const d=assignCustomerSchema.parse(raw);return db.$transaction(async tx=>{const assignee=await tx.user.findFirst({where:{id:d.assignedUserId,companyId,isActive:true,OR:[{role:"SALES"},{role:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true}});if(!assignee)throw new Error("INVALID_ASSIGNMENT");const customer=await tx.customer.findFirst({where:{id:d.customerId,companyId,assignedUserId:null},select:{id:true,name:true,phone:true}});if(!customer)throw new Error("CUSTOMER_NOT_FOUND");await tx.customer.update({where:{id:customer.id},data:{assignedUserId:assignee.id}});await createLeadForCustomer(tx,companyId,admin.id,customer,assignee.id);});}

export async function createCustomer(raw: CreateCustomerInput) {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new Error("NOT_AUTHORIZED");
  const companyId = admin.companyId;
  const data = createCustomerSchema.parse(raw);
  return db.$transaction(async tx=>{
    let assigneeId:string|undefined;
    if(data.assignedUserId){
      const assignee=await tx.user.findFirst({where:{id:data.assignedUserId,companyId,isActive:true,OR:[{role:"SALES"},{role:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true}});
      if(!assignee)throw new Error("INVALID_ASSIGNMENT");
      assigneeId=assignee.id;
    }
    const customer=await tx.customer.create({data:{name:data.name,phone:data.phone,companyId,assignedUserId:assigneeId}});
    if(assigneeId)await createLeadForCustomer(tx,companyId,admin.id,customer,assigneeId);
    return customer;
  });
}

export async function editCustomer(raw: EditCustomerInput) {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new Error("NOT_AUTHORIZED");
  const { customerId, ...data } = editCustomerSchema.parse(raw);
  const updated = await db.customer.updateMany({ where: { id: customerId, companyId: admin.companyId }, data: { ...data, phone: data.phone ?? null, email: data.email ?? null, contactPerson: data.contactPerson ?? null } });
  if (updated.count !== 1) throw new Error("CUSTOMER_NOT_FOUND");
}
