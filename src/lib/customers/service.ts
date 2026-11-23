import {assertCreationIntent,creationIntentHash,publicCreationResult} from "@/lib/mutations/creation-intent";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { assignCustomerSchema, createCustomerSchema, editCustomerSchema, type CreateCustomerInput, type EditCustomerInput } from "./validation";
import { operationalBranchContext, resolveOperationalWriteBranch } from "@/lib/branches/operational-scope";

async function requireCompanyViewer() {
  const user = await requirePermission("SALES_CUSTOMERS");
  if (!user.companyId) throw new Error("NOT_AUTHORIZED");
  return { ...user, companyId: user.companyId };
}

function assertCustomerAdmin(user:{salesRole:string|null}){if(user.salesRole!=="PRIMARY_ADMIN"&&user.salesRole!=="ADMIN")throw new Error("NOT_AUTHORIZED");}

export async function searchCustomers(query = "") {
  const user = await requireCompanyViewer();
  const branches=await operationalBranchContext(user);
  return searchCustomersForCompany(user.companyId,query,user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"?undefined:user.id,branches.branchIds);
}
export async function searchCustomersForCompany(companyId:string,query="",assignedUserId?:string|null,branchIds?:string[],page=1,pageSize=100) {
  const term = query.trim().slice(0, 100),safePage=Math.max(1,Math.trunc(page)||1),safeSize=Math.min(200,Math.max(1,Math.trunc(pageSize)||100));
  return db.customer.findMany({ where: { companyId,branchId:branchIds?{in:branchIds}:undefined,assignedUserId, ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { contactPerson: { contains: term, mode: "insensitive" } }] } : {}) }, orderBy: [{name:"asc"},{id:"asc"}], skip:(safePage-1)*safeSize,take:safeSize });
}
async function createLeadForCustomer(tx:Prisma.TransactionClient,companyId:string,branchId:string,adminId:string,customer:{id:string;name:string;phone:string|null},assignedUserId:string){const existing=await tx.lead.findFirst({where:{companyId,branchId,customerId:customer.id},select:{id:true}});if(existing)return existing;const lead=await tx.lead.create({data:{companyId,branchId,customerId:customer.id,assignedUserId,createdByUserId:adminId,title:customer.name,contactName:customer.name,phone:customer.phone,source:"MANUAL",stage:"NEW"}});await tx.leadActivity.create({data:{companyId,leadId:lead.id,actorUserId:adminId,type:"CREATED",newAssignedUserId:assignedUserId,toStage:"NEW"}});return lead;}
export async function assignCustomer(raw:unknown){const admin=await requirePermissionForMutation("SALES_CUSTOMERS");if(!admin.companyId)throw new Error("NOT_AUTHORIZED");assertCustomerAdmin(admin);const companyId=admin.companyId;const d=assignCustomerSchema.parse(raw);const scope=await operationalBranchContext({id:admin.id,companyId:admin.companyId});return db.$transaction(async tx=>{const assignee=await tx.user.findFirst({where:{id:d.assignedUserId,companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true}});if(!assignee)throw new Error("INVALID_ASSIGNMENT");const customer=await tx.customer.findFirst({where:{id:d.customerId,companyId,branchId:scope.branchId,assignedUserId:null},select:{id:true,name:true,phone:true,branchId:true}});if(!customer)throw new Error("CUSTOMER_NOT_FOUND");await resolveOperationalWriteBranch({id:assignee.id,companyId},customer.branchId,tx);const claimed=await tx.customer.updateMany({where:{id:customer.id,companyId,branchId:customer.branchId,assignedUserId:null},data:{assignedUserId:assignee.id}});if(claimed.count!==1)throw new Error("CUSTOMER_ALREADY_ASSIGNED");await createLeadForCustomer(tx,companyId,customer.branchId,admin.id,customer,assignee.id);});}

export async function createCustomer(raw:CreateCustomerInput){const admin=await requirePermissionForMutation("SALES_CUSTOMERS");if(!admin.companyId)throw new Error("NOT_AUTHORIZED");return createCustomerForActor({...admin,companyId:admin.companyId},raw)}
export async function createCustomerForActor(admin:{id:string;companyId:string;salesRole:string|null},raw:unknown){
 assertCustomerAdmin(admin);const companyId=admin.companyId,data=createCustomerSchema.parse(raw),branchId=await resolveOperationalWriteBranch({id:admin.id,companyId},data.branchId);
 const hash=creationIntentHash({actorId:admin.id,branchId,name:data.name,phone:data.phone,assignedUserId:data.assignedUserId??null});
 const requestWhere=data.creationRequestKey?{companyId_creationRequestKey:{companyId,creationRequestKey:data.creationRequestKey}}:null;
 const replay=(row:NonNullable<Awaited<ReturnType<typeof db.customer.findUnique>>>)=>{if(row.branchId!==branchId)throw new Error("CREATION_REQUEST_CONFLICT");assertCreationIntent(row.creationRequestHash,hash);return publicCreationResult(row)};
 try{return await db.$transaction(async tx=>{
  const existing=requestWhere?await tx.customer.findUnique({where:requestWhere}):null;if(existing)return replay(existing);
  let assigneeId:string|undefined;
  if(data.assignedUserId){const assignee=await tx.user.findFirst({where:{id:data.assignedUserId,companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true}});if(!assignee)throw new Error("INVALID_ASSIGNMENT");assigneeId=assignee.id;await resolveOperationalWriteBranch({id:assigneeId,companyId},branchId,tx)}
  const customer=await tx.customer.create({data:{name:data.name,phone:data.phone,companyId,branchId,assignedUserId:assigneeId,...(data.creationRequestKey?{creationRequestKey:data.creationRequestKey,creationRequestHash:hash}:{})}});
  if(assigneeId)await createLeadForCustomer(tx,companyId,branchId,admin.id,customer,assigneeId);
  return publicCreationResult(customer);
 });}catch(error){if(requestWhere&&(error as {code?:string})?.code==="P2002"){const existing=await db.customer.findUnique({where:requestWhere});if(existing)return replay(existing)}throw error}
}

export async function editCustomer(raw: EditCustomerInput) {
  const admin = await requirePermissionForMutation("SALES_CUSTOMERS");
  if (!admin.companyId) throw new Error("NOT_AUTHORIZED");
  assertCustomerAdmin(admin);
  const branches=await operationalBranchContext({id:admin.id,companyId:admin.companyId});
  const { customerId, ...data } = editCustomerSchema.parse(raw);
  const updated = await db.customer.updateMany({ where: { id: customerId, companyId: admin.companyId, branchId: branches.branchId }, data: { ...data, phone: data.phone ?? null, email: data.email ?? null, contactPerson: data.contactPerson ?? null } });
  if (updated.count !== 1) throw new Error("CUSTOMER_NOT_FOUND");
}
