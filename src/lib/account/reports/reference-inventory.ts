import inventory from "./reference-inventory.json";
export const REFERENCE_REPORT_INVENTORY=inventory.reports;
export function referenceReportAliases(key:string){return REFERENCE_REPORT_INVENTORY.filter(row=>row.destinations.includes(key)).map(row=>row.name)}
export function unavailableReferenceReports(access:{projectManager:boolean;stock:boolean;tax:boolean;money:boolean}){
 if(access.projectManager)return [];
 return REFERENCE_REPORT_INVENTORY.filter(row=>!row.destinations.length&&(row.requirement==="STOCK"?access.stock:row.requirement==="TAX"?access.tax:row.requirement==="MONEY"?access.money:true)).map(row=>({name:row.name,group:row.group,reason:row.reason}));
}
