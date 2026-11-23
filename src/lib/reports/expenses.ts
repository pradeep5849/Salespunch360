import {operationalBranchContext} from "@/lib/branches/operational-scope";
import {db} from "@/lib/db";
import {reportActor,reportEmployeeOptions,resolveEmployeeScope,type ReportActor} from "./scope";
import {parseReportFilters,type SearchParams} from "./validation";
export async function expenseReport(raw:SearchParams,provided?:ReportActor){
 const actor=provided??await reportActor(),filters=parseReportFilters(raw),ids=await resolveEmployeeScope(actor,filters.employeeId),employees=await reportEmployeeOptions(actor),branches=await operationalBranchContext(actor,typeof raw.branchId==="string"?raw.branchId:undefined);
 const [company,approvals]=await Promise.all([
  db.company.findUnique({where:{id:actor.companyId},select:{travelRatePerKm:true}}),
  db.dailyTravelApproval.findMany({where:{companyId:actor.companyId,branchId:branches.branchId,employeeId:{in:ids},businessDate:{gte:new Date(`${filters.startText}T00:00:00Z`),lte:new Date(`${filters.endText}T00:00:00Z`)}},include:{employee:{select:{name:true}}},orderBy:[{businessDate:"desc"},{employeeId:"asc"},{branchId:"asc"}]})
 ]);
 const rows=approvals.map(approval=>{const date=approval.businessDate.toISOString().slice(0,10);return{key:`${approval.branchId}:${approval.employeeId}:${date}`,branchId:approval.branchId,employeeId:approval.employeeId,employee:approval.employee.name,date,distanceMeters:approval.distanceMeters,rate:approval.ratePerKm,ratePerKm:approval.ratePerKm,amount:approval.amount,status:approval.status,approvalMode:approval.status==="APPROVED"&&!approval.reviewedByUserId?"AUTO":"MANUAL",approvedAmount:approval.status==="APPROVED"?approval.amount:null,reviewedAt:approval.reviewedAt}});
 return{actor,filters,employees,rows,pointLimitExceeded:false,companyRate:company?.travelRatePerKm??null};
}
