import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from "./account-package";

type ActiveTermRow={adminSeats:number;managerSeats:number;salesSeats:number;accountPackages:number;startsAt:Date;endsAt:Date;sourceOrder:{provider:string|null}|null};
export function effectiveCurrentTerm(rows:ActiveTermRow[]){
 const sales=rows.filter(x=>x.sourceOrder?.provider!==ACCOUNT_PACKAGE_ORDER_PROVIDER&&(x.adminSeats>0||x.managerSeats>0||x.salesSeats>0));
 const accounts=rows.filter(x=>x.accountPackages>0||x.sourceOrder?.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER);
 const latest=[...sales,...accounts].reduce<Date|null>((m,x)=>!m||x.endsAt>m?x.endsAt:m,null);if(!latest)return null;
 const same=(x:ActiveTermRow)=>x.endsAt.getTime()===latest.getTime(),salesTerm=sales.filter(same),accountTerm=accounts.filter(same),anchor=salesTerm[0]??accountTerm[0];
 return{startsAt:anchor.startsAt,endsAt:latest,adminSeats:salesTerm.reduce((n,x)=>n+x.adminSeats,0),managerSeats:salesTerm.reduce((n,x)=>n+x.managerSeats,0),salesSeats:salesTerm.reduce((n,x)=>n+x.salesSeats,0),accountPackages:accountTerm.reduce((n,x)=>n+(x.accountPackages||(x.sourceOrder?.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER?x.adminSeats:0)),0)};
}
