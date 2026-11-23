import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from './account-package';
type Company={productEdition:string;subscriptionStatus:string;trialEndsAt:Date|null};
type ActivePackage={accountPackages?:number;adminSeats:number;sourceOrder?:{provider:string}|null};
/** Callers supply only currently active subscription terms. Trial capacity is a floor, never a paid-seat bonus. */
export function effectiveAccountCapacity(company:Company,subscriptions:ActivePackage[],now=new Date(),trialAllowed=true){
 if(company.productEdition==='SALESPUNCH360')return {paidPackages:0,trialPackages:0,packageCount:0};
 const paidPackages=subscriptions.reduce((sum,sub)=>sum+(sub.accountPackages||(sub.sourceOrder?.provider===ACCOUNT_PACKAGE_ORDER_PROVIDER?sub.adminSeats:0)),0);
 const trialPackages=trialAllowed&&company.subscriptionStatus==='TRIAL'&&company.trialEndsAt&&company.trialEndsAt>now?1:0;
 return {paidPackages,trialPackages,packageCount:Math.max(paidPackages,trialPackages)};
}
