import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from './account-package';
export function operationalSalesStatus(entitlement:{paidActive:boolean;trialActive:boolean}|null){return entitlement?(entitlement.paidActive?'ACTIVE':entitlement.trialActive?'TRIAL':'RESTRICTED'):'INACTIVE'}
/** Only effective terms supplied by the caller are considered; do not imply all capacity shares the latest expiry. */
export function nextAccountPackageExpiry(terms:{endsAt:Date;accountPackages:number;adminSeats:number;sourceOrder?:{provider:string}|null}[]){
 const packages=terms.map(term=>({endsAt:term.endsAt,count:term.accountPackages||(term.sourceOrder?.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER?term.adminSeats:0)})).filter(term=>term.count>0);
 if(!packages.length)return{nextPackageExpiry:null,expiringPackageCount:0};
 const next=Math.min(...packages.map(term=>term.endsAt.getTime()));
 return{nextPackageExpiry:new Date(next),expiringPackageCount:packages.filter(term=>term.endsAt.getTime()===next).reduce((sum,term)=>sum+term.count,0)};
}
