import {billingDashboard} from '@/lib/billing/service';
import {getTelecallerBillingOverview} from '@/lib/billing/telecaller';

export type BillingPeriod='SIX_MONTH'|'YEARLY';
export type ActiveSalesEmployee={id:string;name:string;salesRole:'ADMIN'|'MANAGER'|'SALES';managerType?:string|null};

export const orderErrors:Record<string,string>={
 SEATS_BELOW_USAGE:'The selected seat count is below your current active users. Keep enough seats for the active team before creating this order.',
 TELECALLER_SEATS_BELOW_USAGE:'Telecaller seats cannot be below the number of active Telecallers. Deactivate the Telecaller first, then renew.',
 INVALID_SEAT_SELECTION:'The selected users to retain do not match the active team. Review the retention selection and try again.',
 SEAT_SELECTION_REQUIRED:'For a seat reduction, leave retention empty for automatic retention or select exactly the users you want to keep.',
 SEAT_REDUCTION_SELECTION_REQUIRED:'The renewal retention selection is no longer valid. Review the active users and try again.',
 PRICING_UNAVAILABLE:'Current subscription pricing is unavailable. Please try again shortly.',
 MANAGERS_DISABLED:'Manager seats are not available for the selected Sales team structure.',
 PLUS_ACCOUNT_PACKAGE_REQUIRED:'Plus requires at least one Account package.',
 ACCOUNT_PACKAGE_NOT_ALLOWED:'Account packages are not available for this Sales-only order.',
 RATE_LIMITED:'Too many billing requests were submitted. Wait a minute and try again.',
 UNTRUSTED_ORIGIN:'The billing security check could not verify this request. Return to Billing and try again.',
 INVALID_INPUT:'The billing request is incomplete. Review the selected plan and try again.',
 ORDER_CREATE_FAILED:'The payment request could not be created. Please review the order and try again.'
};

export const dateText=(value:Date|null|undefined)=>value?value.toLocaleDateString('en-IN'):'—';

export async function loadBillingPageData(){
 const r=await billingDashboard();
 const e=r.entitlement;
 const telecaller=r.hasSales?await getTelecallerBillingOverview():null;
 const managersEnabled=r.company?.teamStructure==='MANAGERS_AND_SALES';
 const backHref=r.company?.productEdition==='SALESPUNCH360_ACCOUNT'?'/workspace/account':'/workspace';
 const price=(role:'ADMIN'|'MANAGER'|'SALES',period:BillingPeriod,fallback:number)=>Number(r.prices.find(p=>p.role===role&&p.period===period)?.amount??fallback);
 const prices={SIX_MONTH:{admin:price('ADMIN','SIX_MONTH',1400),manager:price('MANAGER','SIX_MONTH',1100),sales:price('SALES','SIX_MONTH',800)},YEARLY:{admin:price('ADMIN','YEARLY',2800),manager:price('MANAGER','YEARLY',2100),sales:price('SALES','YEARLY',1500)}};
 const telecallerPrices={SIX_MONTH:Number(telecaller?.prices.SIX_MONTH??600),YEARLY:Number(telecaller?.prices.YEARLY??1000)};
 const accountPrices={SIX_MONTH:r.account.sixMonthUnitPrice,YEARLY:r.account.yearlyUnitPrice};
 const accountCurrent=r.account.subscriptions[0];
 const isPlus=r.company?.productEdition==='SALESPUNCH360_PLUS';
 const salesStatus=e?(e.paidActive?'ACTIVE':e.trialActive?'TRIAL':r.company?.subscriptionStatus==='ACTIVE'?'ACTIVE':'INACTIVE'):'INACTIVE';
 const accountStatus=accountCurrent?'ACTIVE':r.company?.subscriptionStatus==='TRIAL'&&r.account.packageCount>0?'TRIAL':'INACTIVE';
 const activePeriod=(e?.subscription?.billingPeriod??'SIX_MONTH') as BillingPeriod;
 const activeEmployees=r.activeEmployees as ActiveSalesEmployee[];
 return {r,e,telecaller,managersEnabled,backHref,prices,telecallerPrices,accountPrices,accountCurrent,isPlus,salesStatus,accountStatus,activePeriod,activeEmployees};
}
