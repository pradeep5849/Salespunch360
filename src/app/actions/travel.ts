"use server";
import {revalidatePath} from "next/cache";
import{redirect}from"next/navigation";
import {reviewDailyTravel,updateCompanyTravelRate,updateEmployeeTravelSettings} from "@/lib/travel/service";
import {mutationGuard} from "@/lib/security/request";

export async function updateCompanyTravelRateAction(formData:FormData){
 await mutationGuard("travel-rate",20);
 await updateCompanyTravelRate(formData.get("travelRatePerKm"));
 revalidatePath("/workspace/settings");
 revalidatePath("/workspace/reports/expenses");
}
export async function updateEmployeeTravelSettingsAction(formData:FormData){
 await mutationGuard("employee-travel",30);
 const mode=formData.get("travelApprovalMode")==="AUTO"?"AUTO":"MANUAL";
 await updateEmployeeTravelSettings(String(formData.get("employeeId")),formData.get("travelAllowanceEnabled")==="on",formData.get("travelRatePerKm")?String(formData.get("travelRatePerKm")):null,mode);
 revalidatePath("/workspace/employees");
 revalidatePath("/workspace/reports/expenses");
 if(formData.get("returnTo")==="/workspace/employees")redirect("/workspace/employees");
}
export async function reviewDailyTravelAction(formData:FormData){
 await mutationGuard("travel-approval",60);
 const status=String(formData.get("status"));
 if(status!=="APPROVED"&&status!=="REJECTED")throw new Error("INVALID_STATUS");
 await reviewDailyTravel(String(formData.get("employeeId")),String(formData.get("date")),status,String(formData.get("branchId")));
 revalidatePath("/workspace/reports/expenses");
}
