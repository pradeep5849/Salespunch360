export const TELECALLER_DESIGNATION="Telecaller" as const;
export const isTelecallerDesignation=(designation:string|null|undefined)=>designation?.trim().toLowerCase()===TELECALLER_DESIGNATION.toLowerCase();
export const isTelecaller=(user:{salesRole:string|null;designation?:string|null})=>user.salesRole==="SALES"&&isTelecallerDesignation(user.designation);

export const TELECALLING_RESULTS=["CONNECTED","NO_ANSWER","BUSY","NOT_REACHABLE","WRONG_NUMBER","CALL_BACK","NOT_INTERESTED","INTERESTED","WANTS_VISIT","WANTS_QUOTATION"] as const;
export type TelecallingResult=(typeof TELECALLING_RESULTS)[number];
export const SALES_HANDOFF_RESULTS=new Set<TelecallingResult>(["INTERESTED","WANTS_VISIT","WANTS_QUOTATION"]);
export const SALES_ACTION_STATUSES=["PENDING","ACKNOWLEDGED","ACTION_TAKEN"] as const;
export type SalesActionStatus=(typeof SALES_ACTION_STATUSES)[number];

export function telecallingLeadScope(user:{id:string;salesRole:string|null;managerType?:string|null;designation?:string|null}){
 if(isTelecaller(user))return {};
 if(user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN")return {};
 if(user.salesRole==="MANAGER")return user.managerType==="MANAGER_ONLY"?{assignedUser:{salesRole:"SALES" as const,managerId:user.id}}:{OR:[{assignedUserId:user.id},{assignedUser:{salesRole:"SALES" as const,managerId:user.id}}]};
 return {assignedUserId:user.id};
}
