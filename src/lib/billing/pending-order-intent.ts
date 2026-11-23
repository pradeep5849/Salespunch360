export class PendingOrderConflict extends Error {
 constructor(readonly orderId:string){super("PENDING_ORDER_CONFLICT");}
}
export type PendingOrderIntent={billingPeriod:string;purchasePurpose?:"RENEWAL"|"ADDITION";adminSeats?:number;managerSeats?:number;salesSeats?:number;accountPackages:number;telecallerSeats?:number;retainAdminUserIds?:string[];retainManagerUserIds?:string[];retainSalesUserIds?:string[]};
type StoredIntent=Omit<PendingOrderIntent,"telecallerSeats">;
const ids=(values:string[]|undefined)=>JSON.stringify([...(values??[])].sort());
export function pendingOrderMatches(order:StoredIntent,intent:PendingOrderIntent,telecallerSeats=0,storedPurpose?:"RENEWAL"|"ADDITION"){
 return (!intent.purchasePurpose||intent.purchasePurpose===storedPurpose) && order.billingPeriod===intent.billingPeriod &&
  (["adminSeats","managerSeats","salesSeats","accountPackages"] as const).every(key=>(order[key]??0)===(intent[key]??0)) &&
  telecallerSeats===(intent.telecallerSeats??0) &&
  (["retainAdminUserIds","retainManagerUserIds","retainSalesUserIds"] as const).every(key=>ids(order[key])===ids(intent[key]));
}
