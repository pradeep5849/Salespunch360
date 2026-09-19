import {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {effectiveEntitlement} from '@/lib/billing/entitlement';
import {editEmployeeSchema,changeSalesRoleSchema} from '@/lib/employees/validation';
import {assertAssignableManager,assertManagedEmployee,EmployeePolicyError} from '@/lib/employees/policy';
import {assertLeavingManagerSafe,assertManagerOnlyTransitionSafe} from '@/lib/employees/manager-type-transition';
import {salesRoleAssignment,salesRoleTransitionUpdate} from '@/lib/employees/role-transition-policy';
import {assertSalesEmployeePhoneUnique} from '@/lib/users/employee-profile';
import {editAdditionalAdminForCompany,setAdditionalAdminActiveForCompany} from '@/lib/users/additional-admin';
import type {MobilePrincipal} from './auth';
import {MobileEmployeeError} from './employees';

function primary(p:MobilePrincipal){if(p.salesRole!=='PRIMARY_ADMIN')throw new MobileEmployeeError('FORBIDDEN',403);return p.companyId}
async function actor(tx:Prisma.TransactionClient,companyId:string,actorId:string){const row=await tx.user.findFirst({where:{id:actorId,companyId,salesRole:'PRIMARY_ADMIN',isActive:true,salesAccessActive:true},select:{id:true}});if(!row)throw new MobileEmployeeError('FORBIDDEN',403)}
async function assignableManager(tx:Prisma.TransactionClient,companyId:string,managerId?:string|null){if(!managerId)return null;const manager=await tx.user.findFirst({where:{id:managerId,companyId},select:{id:true,companyId:true,salesRole:true,isActive:true,salesAccessActive:true}});assertAssignableManager(companyId,manager);return manager.id}
async function validateBranches(tx:Prisma.TransactionClient,companyId:string,scope:'ALL_BRANCHES'|'SELECTED_BRANCHES',ids:string[]){const unique=[...new Set(ids)];if(scope==='SELECTED_BRANCHES'){if(!unique.length)throw new Error('BRANCH_REQUIRED');const count=await tx.branch.count({where:{companyId,id:{in:unique},isActive:true}});if(count!==unique.length)throw new Error('INVALID_BRANCH')}return scope==='SELECTED_BRANCHES'?unique:[]}
function normalizedRate(value:unknown){if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000)throw new Error('INVALID_RATE');return new Prisma.Decimal(n.toFixed(2))}

export async function mobileEditEmployee(p:MobilePrincipal,raw:unknown){
 const companyId=primary(p);if(!raw||typeof raw!=='object')throw new MobileEmployeeError('INVALID_INPUT');const input=raw as Record<string,unknown>,employeeId=String(input.employeeId??'');
 const current=await db.user.findFirst({where:{id:employeeId,companyId,salesRole:{in:['ADMIN','MANAGER','SALES']}},select:{salesRole:true}});if(!current)throw new EmployeePolicyError('NOT_FOUND');
 if(current.salesRole==='ADMIN'){
  await editAdditionalAdminForCompany(companyId,{userId:employeeId,name:input.name,email:input.email,phone:input.phone},p.id);return{ok:true};
 }
 const parsed=editEmployeeSchema.parse({employeeId,name:input.name,email:input.email,phone:input.phone,employeeCode:input.employeeCode,designation:input.designation,dateOfJoining:input.dateOfJoining,managerId:input.managerId,managerType:input.managerType});
 const scope=input.branchAccessScope==='SELECTED_BRANCHES'?'SELECTED_BRANCHES':'ALL_BRANCHES',branchIds=Array.isArray(input.branchIds)?input.branchIds.filter((x):x is string=>typeof x==='string'):[],travelEnabled=Boolean(input.travelAllowanceEnabled),travelRate=normalizedRate(input.travelRatePerKm);
 await db.$transaction(async tx=>{
  await actor(tx,companyId,p.id);
  const company=await tx.company.findUnique({where:{id:companyId},select:{teamStructure:true}});if(!company)throw new EmployeePolicyError('NOT_FOUND');
  const employee=await tx.user.findFirst({where:{id:parsed.employeeId,companyId,salesRole:{in:['MANAGER','SALES']}},select:{id:true,companyId:true,salesRole:true,salesAccessActive:true,isActive:true,managerId:true,managerType:true,designation:true,dateOfJoining:true}});assertManagedEmployee(companyId,employee);
  if(company.teamStructure==='SALES_ONLY'&&parsed.managerId)throw new EmployeePolicyError('MANAGERS_DISABLED');
  await assertSalesEmployeePhoneUnique(tx,companyId,parsed.phone,employee.id);
  if(employee.salesRole==='MANAGER'&&parsed.managerId)throw new EmployeePolicyError('INVALID_MANAGER');
  if(employee.salesRole==='MANAGER'&&parsed.managerType&&parsed.managerType!==employee.managerType&&parsed.managerType==='MANAGER_ONLY')await assertManagerOnlyTransitionSafe(tx,companyId,employee.id);
  const managerId=employee.salesRole==='SALES'&&parsed.managerId!==undefined?(parsed.managerId===employee.managerId?employee.managerId:await assignableManager(tx,companyId,parsed.managerId)):employee.managerId;
  const validBranchIds=await validateBranches(tx,companyId,scope,branchIds);
  await tx.userBranchAccess.deleteMany({where:{userId:employee.id}});
  await tx.user.update({where:{id:employee.id},data:{name:parsed.name,email:parsed.email,phone:parsed.phone??null,employeeCode:parsed.employeeCode??null,designation:parsed.designation===undefined?employee.designation:parsed.designation,dateOfJoining:parsed.dateOfJoining===undefined?employee.dateOfJoining:parsed.dateOfJoining,managerId,managerType:employee.salesRole==='MANAGER'?(parsed.managerType??employee.managerType??'FIELD_MANAGER'):null,branchAccessScope:scope,branchAccesses:validBranchIds.length?{create:validBranchIds.map(branchId=>({branchId}))}:undefined,travelAllowanceEnabled:travelEnabled,travelRatePerKm:travelRate}});
 });
 return{ok:true};
}

export async function mobileChangeEmployeeRole(p:MobilePrincipal,raw:unknown){
 const companyId=primary(p),data=changeSalesRoleSchema.parse(raw);
 return db.$transaction(async tx=>{
  await actor(tx,companyId,p.id);
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${data.employeeId}::uuid AND "companyId"=${companyId}::uuid FOR UPDATE`;
  const company=await tx.company.findUnique({where:{id:companyId},select:{teamStructure:true}});if(!company)throw new EmployeePolicyError('NOT_FOUND');
  const target=await tx.user.findFirst({where:{id:data.employeeId,companyId,salesRole:{in:['ADMIN','MANAGER','SALES']}},select:{id:true,salesRole:true,managerType:true,managerId:true,isActive:true,salesAccessActive:true,accountRole:true,accountAccessActive:true}});if(!target)throw new EmployeePolicyError('NOT_FOUND');
  const assignment=salesRoleAssignment(data.role,data.managerId),nextRole=assignment.salesRole,nextManagerType=assignment.managerType;
  if(company.teamStructure==='SALES_ONLY'&&nextRole==='MANAGER')throw new EmployeePolicyError('MANAGERS_DISABLED');
  if(nextRole==='MANAGER'&&nextManagerType==='MANAGER_ONLY'&&(target.salesRole!=='MANAGER'||target.managerType!=='MANAGER_ONLY'))await assertManagerOnlyTransitionSafe(tx,companyId,target.id);
  if(target.salesRole==='MANAGER'&&nextRole!=='MANAGER')await assertLeavingManagerSafe(tx,companyId,target.id);
  if(target.isActive&&target.salesAccessActive&&nextRole!==target.salesRole){const entitlement=await effectiveEntitlement(companyId);const usage=nextRole==='ADMIN'?entitlement.adminUsage:nextRole==='MANAGER'?entitlement.managerUsage:entitlement.salesUsage,limit=nextRole==='ADMIN'?entitlement.adminLimit:nextRole==='MANAGER'?entitlement.managerLimit:entitlement.salesLimit;if(usage>=limit)throw new EmployeePolicyError('SEAT_LIMIT')}
  const managerId=nextRole==='SALES'?await assignableManager(tx,companyId,assignment.managerId):null;
  if(nextRole==='ADMIN')await tx.userBranchAccess.deleteMany({where:{userId:target.id}});
  await tx.user.update({where:{id:target.id},data:{...salesRoleTransitionUpdate(target,{...assignment,managerId}),branchAccessScope:nextRole==='ADMIN'?'ALL_BRANCHES':undefined,sessionVersion:{increment:1}}});
  return{ok:true};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function mobileSetAnyEmployeeActive(p:MobilePrincipal,employeeId:string,isActive:boolean){
 const companyId=primary(p);const target=await db.user.findFirst({where:{id:employeeId,companyId,salesRole:{in:['ADMIN','MANAGER','SALES']}},select:{salesRole:true}});if(!target)throw new EmployeePolicyError('NOT_FOUND');
 if(target.salesRole==='ADMIN'){await setAdditionalAdminActiveForCompany(companyId,{userId:employeeId},isActive,p.id);return{ok:true}}
 const service=await import('@/lib/employees/service');if(isActive)await service.reactivateEmployeeForCompany(companyId,{employeeId},p.id);else await service.deactivateEmployeeForCompany(companyId,{employeeId},p.id);return{ok:true};
}
