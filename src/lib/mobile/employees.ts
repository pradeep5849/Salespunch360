import {effectiveEntitlement} from '@/lib/billing/entitlement';
import {profileComplete} from '@/lib/company/profile';
import {db} from '@/lib/db';
import {createManagerForCompany,createSalesEmployeeForCompany,getEmployeeManagementContextForCompany} from '@/lib/employees/service';
import {createAdditionalAdminForCompany,listAdditionalAdminsForCompany} from '@/lib/users/additional-admin';
import {mobileCan,type MobilePrincipal} from './auth';
import {mobileChangeEmployeeRole,mobileEditEmployee,mobileSetAnyEmployeeActive} from './employee-admin';
import {resetMobileDeviceForUser} from './device-binding';

export class MobileEmployeeError extends Error{constructor(public code:string,public status=400){super(code)}}
function admin(principal:MobilePrincipal){if(!mobileCan(principal,'SALES_USER_ADMIN'))throw new MobileEmployeeError('FORBIDDEN',403);return principal.companyId}
function primary(principal:MobilePrincipal){const companyId=admin(principal);if(principal.salesRole!=='PRIMARY_ADMIN')throw new MobileEmployeeError('FORBIDDEN',403);return companyId}

export async function mobileEmployeeContext(principal:MobilePrincipal){
 const companyId=admin(principal);
 const [context,admins,entitlement,company,branches]=await Promise.all([
  getEmployeeManagementContextForCompany(companyId),
  listAdditionalAdminsForCompany(companyId),
  effectiveEntitlement(companyId),
  db.company.findUnique({where:{id:companyId},select:{name:true,teamStructure:true,addressLine1:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true}}),
  db.branch.findMany({where:{companyId,isActive:true},select:{id:true,name:true,code:true,isPrimary:true},orderBy:[{isPrimary:'desc'},{name:'asc'}]})
 ]);
 const employees=[
  ...admins.map(user=>({id:user.id,name:user.name,email:user.email,phone:user.phone,employeeCode:null,designation:null,dateOfJoining:null,role:'ADMIN' as const,isActive:user.isActive,salesAccessActive:user.salesAccessActive,managerId:null,manager:null,managerType:null,branchAccessScope:'ALL_BRANCHES',branchIds:[],travelAllowanceEnabled:false,travelRatePerKm:null})),
  ...context.employees.map(user=>({id:user.id,name:user.name,email:user.email,phone:user.phone,employeeCode:user.employeeCode,designation:user.designation,dateOfJoining:user.dateOfJoining,role:user.salesRole,isActive:user.isActive,salesAccessActive:user.salesAccessActive,managerId:user.managerId,manager:user.manager,managerType:user.managerType,branchAccessScope:user.branchAccessScope,branchIds:user.branchAccesses.map(access=>access.branch.id),travelAllowanceEnabled:user.travelAllowanceEnabled,travelRatePerKm:user.travelRatePerKm}))
 ];
 return{employees,branches,canManage:principal.salesRole==='PRIMARY_ADMIN',teamStructure:context.teamStructure,profileComplete:Boolean(company&&profileComplete(company as unknown as Record<string,unknown>)),entitlement:{state:entitlement.state,operationalWritesAllowed:entitlement.operationalWritesAllowed,adminLimit:entitlement.adminLimit,managerLimit:entitlement.managerLimit,salesLimit:entitlement.salesLimit,adminUsage:entitlement.adminUsage,managerUsage:entitlement.managerUsage,salesUsage:entitlement.salesUsage}};
}

export async function mobileCreateEmployee(principal:MobilePrincipal,raw:unknown){
 const companyId=primary(principal);if(!raw||typeof raw!=='object')throw new MobileEmployeeError('INVALID_INPUT');const {role,...input}=raw as Record<string,unknown>;
 const created=role==='ADMIN'?await createAdditionalAdminForCompany(companyId,input,principal.id):role==='MANAGER'?await createManagerForCompany(companyId,input,principal.id):role==='SALES'?await createSalesEmployeeForCompany(companyId,input,principal.id):null;
 if(!created)throw new MobileEmployeeError('INVALID_ROLE');
 const context=await mobileEmployeeContext(principal),employee=context.employees.find(item=>item.id===created.id);if(!employee)throw new MobileEmployeeError('NOT_FOUND',404);return employee;
}
export async function mobileSetEmployeeActive(principal:MobilePrincipal,raw:unknown){primary(principal);if(!raw||typeof raw!=='object')throw new MobileEmployeeError('INVALID_INPUT');const {employeeId,isActive}=raw as Record<string,unknown>;if(typeof employeeId!=='string'||typeof isActive!=='boolean')throw new MobileEmployeeError('INVALID_INPUT');return mobileSetAnyEmployeeActive(principal,employeeId,isActive)}
export async function mobileEditEmployeeDetails(principal:MobilePrincipal,raw:unknown){primary(principal);return mobileEditEmployee(principal,raw)}
export async function mobileChangeRole(principal:MobilePrincipal,raw:unknown){primary(principal);return mobileChangeEmployeeRole(principal,raw)}
export async function mobileResetEmployeeDevice(principal:MobilePrincipal,raw:unknown){const companyId=primary(principal);if(!raw||typeof raw!=='object')throw new MobileEmployeeError('INVALID_INPUT');const {employeeId}=raw as Record<string,unknown>;if(typeof employeeId!=='string')throw new MobileEmployeeError('INVALID_INPUT');return resetMobileDeviceForUser(companyId,employeeId)}
