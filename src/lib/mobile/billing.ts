import {purchasePurposeForCompany} from "@/lib/billing/purchase-purpose";
import {z} from "zod";
import {cancelPendingOrderForActor} from "@/lib/billing/service";
import {paymentDetailSelect,orderTelecallerTargets} from "@/lib/billing/history-details";
import {operationalSalesStatus,nextAccountPackageExpiry} from "@/lib/billing/subscription-display";
import {effectiveAccountCapacity} from "@/lib/billing/account-capacity";
import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {currentPrices,createMobileAccountPackageOrder} from "@/lib/billing/service";
import {createUnifiedMobileSalesTeamOrder,telecallerQuoteForCompany} from "@/lib/billing/unified-sales-team";
import {telecallerBillingState} from "@/lib/billing/telecaller";
import {quoteCombinedOrder} from "@/lib/billing/combined-order";
import {effectiveCurrentTerm} from "@/lib/billing/current-term";
import {effectiveEntitlement} from "@/lib/billing/entitlement";
import {ACCOUNT_PACKAGE_ROLES,ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR,ACCOUNT_PACKAGE_YEARLY_PRICE_INR,accountPackageLimits} from "@/lib/billing/account-package";
import {editionAllowsAccount,editionAllowsSales} from "@/lib/product/entitlements";
import {mobileCan,type MobilePrincipal} from "./auth";
import {MobileCompanyError} from "./company";

function access(p:MobilePrincipal){if(p.salesRole!=="PRIMARY_ADMIN"||!mobileCan(p,"SALES_BILLING"))throw new MobileCompanyError("FORBIDDEN",403);return p.companyId}

export async function mobileBillingContext(p:MobilePrincipal,page=1){
 const companyId=access(p),now=new Date();
 const company=await db.company.findUnique({where:{id:companyId},select:{productEdition:true,teamStructure:true,subscriptionStatus:true,trialStartedAt:true,trialEndsAt:true}});
 if(!company)throw new MobileCompanyError("NOT_FOUND",404);
 const hasSales=editionAllowsSales(company.productEdition),hasAccount=editionAllowsAccount(company.productEdition),isPlus=company.productEdition==="SALESPUNCH360_PLUS";
 const pageSize=10,safePage=Number.isInteger(page)&&page>0?page:1;const [prices,orders,orderCount,entitlement,telecaller,accountSeatUsers,activeSubs,salesSeatUsers]=await Promise.all([
  currentPrices(),
  db.billingOrder.findMany({where:{companyId},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(safePage-1)*pageSize,take:pageSize,select:{id:true,status:true,billingPeriod:true,adminSeats:true,managerSeats:true,salesSeats:true,accountPackages:true,totalAmount:true,currency:true,provider:true,createdAt:true,expiresAt:true,paidAt:true,payments:{where:{companyId},select:paymentDetailSelect}}}),
  db.billingOrder.count({where:{companyId}}),
  hasSales?effectiveEntitlement(companyId,now):Promise.resolve(null),
  hasSales?telecallerBillingState(db,companyId,now):Promise.resolve({subscription:null,used:0,limit:0,available:0}),
  hasAccount?db.user.findMany({where:{companyId,isActive:true,accountAccessActive:true,accountRole:{not:null}},select:{accountRole:true}}):Promise.resolve([]),
  db.companySubscription.findMany({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now}},orderBy:{endsAt:"desc"},select:{adminSeats:true,managerSeats:true,salesSeats:true,accountPackages:true,billingPeriod:true,startsAt:true,endsAt:true,sourceOrder:{select:{provider:true}}}}),
  hasSales?db.user.findMany({where:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:["ADMIN","MANAGER","SALES"]}},select:{id:true,name:true,salesRole:true},orderBy:[{salesRole:"asc"},{name:"asc"}]}):Promise.resolve([])
 ]);
 const accountSubs=activeSubs.filter(sub=>sub.accountPackages>0||sub.sourceOrder?.provider==="ACCOUNT_PACKAGE");
 const accountCapacity=effectiveAccountCapacity(company,accountSubs,now,hasAccount),trialAccountPackages=accountCapacity.trialPackages;
 const accountPackageCount=accountCapacity.packageCount,accountLimits=accountPackageLimits(accountPackageCount);
 const accountUsage=Object.fromEntries(ACCOUNT_PACKAGE_ROLES.map(role=>[role,accountSeatUsers.filter(user=>user.accountRole===role).length])) as Record<(typeof ACCOUNT_PACKAGE_ROLES)[number],number>;
 const accountCurrent=accountSubs[0]??null;
 const telecallerTargets=await orderTelecallerTargets(companyId,orders.map(order=>order.id));
 return{
  hasSales,hasAccount,isPlus,teamStructure:company.teamStructure,
  prices:prices.map(x=>({...x,amount:x.amount.toFixed(2)})),
  orders:orders.map(x=>({...x,totalAmount:x.totalAmount.toFixed(2),telecallerSeats:telecallerTargets.get(x.id)??null,payments:x.payments.map(payment=>({...payment,amount:payment.amount.toFixed(2)}))})),
  onlinePaymentAvailable:process.env.CASHFREE_ENV==='sandbox' && Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),salesSeatUsers,orderPage:safePage,orderTotalPages:Math.max(1,Math.ceil(orderCount/pageSize)),hasMoreOrders:safePage*pageSize<orderCount,
  sales:entitlement?{
   status:operationalSalesStatus(entitlement),
   endsAt:entitlement.subscription?.endsAt??company.trialEndsAt,
   billingPeriod:entitlement.subscription?.billingPeriod??null,
   adminUsage:entitlement.adminUsage,adminLimit:entitlement.adminLimit,
   managerUsage:entitlement.managerUsage,managerLimit:entitlement.managerLimit,
   salesUsage:entitlement.salesUsage,salesLimit:entitlement.salesLimit,
   telecallerUsage:telecaller.used,telecallerLimit:telecaller.limit
  }:null,
  account:hasAccount?{
   ...nextAccountPackageExpiry(accountSubs),
   status:accountCurrent?"ACTIVE":trialAccountPackages?"TRIAL":"INACTIVE",
   endsAt:accountCurrent?.endsAt??(trialAccountPackages?company.trialEndsAt:null),
   packageCount:accountPackageCount,
   accountAdminUsage:accountUsage.ACCOUNT_ADMIN,accountAdminLimit:accountLimits.ACCOUNT_ADMIN,
   accountantUsage:accountUsage.ACCOUNTANT,accountantLimit:accountLimits.ACCOUNTANT,
   projectManagerUsage:accountUsage.PROJECT_MANAGER,projectManagerLimit:accountLimits.PROJECT_MANAGER,
   dataEntryUsage:accountUsage.DATA_ENTRY,dataEntryLimit:accountLimits.DATA_ENTRY
  }:null
 };
}

export async function mobileBillingQuote(p:MobilePrincipal,raw:unknown){
 access(p);const input=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;const prices=await currentPrices();
 if(input.kind==="ACCOUNT_PACKAGE"){
  const quantity=Number(input.quantity),period=input.billingPeriod;
  if(!Number.isInteger(quantity)||quantity<1||quantity>100||(period!=="SIX_MONTH"&&period!=="YEARLY"))throw new MobileCompanyError("INVALID_INPUT");
  const unit=prices.find(x=>x.role==="ACCOUNT_PACKAGE"&&x.period===period)?.amount??new Prisma.Decimal(period==="SIX_MONTH"?ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR:ACCOUNT_PACKAGE_YEARLY_PRICE_INR);
  return{kind:"ACCOUNT_PACKAGE",billingPeriod:period,quantity,unitPrice:unit.toFixed(2),totalAmount:unit.mul(quantity).toFixed(2),currency:"INR"};
 }
 const purchaseMode=input.purchaseMode as "RENEW"|"ADD_TEAM"|"ADD_ACCOUNT"|undefined;
 if(purchaseMode!=null&&!['RENEW','ADD_TEAM','ADD_ACCOUNT'].includes(purchaseMode))throw new MobileCompanyError("INVALID_INPUT");
 const period=input.billingPeriod;
 if(typeof period!=="string"||!["SIX_MONTH","YEARLY"].includes(period))throw new MobileCompanyError("INVALID_INPUT");
 const a=Number(input.adminSeats??0),m=Number(input.managerSeats??0),s=Number(input.salesSeats??0),telecallerSeats=Number(input.telecallerSeats??0),accountPackages=Number(input.accountPackages??0);
 if(![a,m,s,telecallerSeats,accountPackages].every(Number.isInteger)||Math.min(a,m,s,telecallerSeats,accountPackages)<0||m+s<1)throw new MobileCompanyError("INVALID_INPUT");
 const ap=prices.find(x=>x.role==="ADMIN"&&x.period===period),mp=prices.find(x=>x.role==="MANAGER"&&x.period===period),sp=prices.find(x=>x.role==="SALES"&&x.period===period);
 if(!ap||!mp||!sp)throw new MobileCompanyError("PRICING_UNAVAILABLE",409);
 const company=await db.company.findUnique({where:{id:p.companyId},select:{productEdition:true}}),plus=company?.productEdition==="SALESPUNCH360_PLUS";
 if(plus&&accountPackages<1)throw new MobileCompanyError("PLUS_ACCOUNT_PACKAGE_REQUIRED",409);
 if(!plus&&accountPackages!==0)throw new MobileCompanyError("INVALID_INPUT");
 const accountUnit=plus?(prices.find(x=>x.role==="ACCOUNT_PACKAGE"&&x.period===period)?.amount??new Prisma.Decimal(period==="SIX_MONTH"?ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR:ACCOUNT_PACKAGE_YEARLY_PRICE_INR)):new Prisma.Decimal(0),now=new Date(),active=await db.companySubscription.findMany({where:{companyId:p.companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now}},select:{billingPeriod:true,adminSeats:true,managerSeats:true,salesSeats:true,accountPackages:true,startsAt:true,endsAt:true,sourceOrder:{select:{provider:true}}},orderBy:{endsAt:"desc"}}),currentTerm=effectiveCurrentTerm(active),purchasePurpose=await purchasePurposeForCompany(db,p.companyId,{purchaseMode:purchaseMode??undefined,billingPeriod:period,adminSeats:a,managerSeats:m,salesSeats:s,telecallerSeats,accountPackages},now,currentTerm),base=quoteCombinedOrder({purchasePurpose,period:period as "SIX_MONTH"|"YEARLY",adminSeats:a,managerSeats:m,salesSeats:s,accountPackages:plus?accountPackages:0,adminPrice:ap.amount,managerPrice:mp.amount,salesPrice:sp.amount,accountPrice:plus?accountUnit:undefined,now,currentTerm});
 const telecaller=await telecallerQuoteForCompany(p.companyId,period as "SIX_MONTH"|"YEARLY",telecallerSeats,now,db,purchasePurpose),ids=(key:string)=>Array.isArray(input[key])?input[key].filter((x):x is string=>typeof x==="string"):[];
 return{purchaseMode:purchaseMode??undefined,kind:plus?"PLUS":"SALES",billingPeriod:period,adminSeats:a,managerSeats:m,salesSeats:s,telecallerSeats,accountPackages,retainAdminUserIds:ids("retainAdminUserIds"),retainManagerUserIds:ids("retainManagerUserIds"),retainSalesUserIds:ids("retainSalesUserIds"),totalAmount:base.subtotal.plus(telecaller.subtotal).toFixed(2),salesSubtotal:base.salesSubtotal.toFixed(2),telecallerSubtotal:telecaller.subtotal.toFixed(2),accountSubtotal:base.accountSubtotal.toFixed(2),prorated:base.prorated||telecaller.prorated,coTermEndsAt:base.coTermEndsAt??telecaller.coTermEndsAt,currency:"INR"};
}

export async function mobileManualOrder(p:MobilePrincipal,raw:unknown){
 access(p);const input=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;
 if(input.paymentMethod!=="MANUAL")throw new MobileCompanyError("INVALID_PAYMENT_METHOD");
 if(input.kind==="ACCOUNT_PACKAGE"){
  const quantity=Number(input.quantity),period=input.billingPeriod;
  if(period!=="SIX_MONTH"&&period!=="YEARLY")throw new MobileCompanyError("INVALID_INPUT");
  return createMobileAccountPackageOrder({id:p.id,companyId:p.companyId},quantity,period);
 }
 const key=typeof input.idempotencyKey==="string"?input.idempotencyKey:"";
 return createUnifiedMobileSalesTeamOrder({id:p.id,companyId:p.companyId},{purchaseMode:input.purchaseMode,billingPeriod:input.billingPeriod as "SIX_MONTH"|"YEARLY",adminSeats:Number(input.adminSeats??0),managerSeats:Number(input.managerSeats??0),salesSeats:Number(input.salesSeats??0),telecallerSeats:Number(input.telecallerSeats??0),accountPackages:Number(input.accountPackages??0),retainAdminUserIds:Array.isArray(input.retainAdminUserIds)?input.retainAdminUserIds.filter((x):x is string=>typeof x==="string"):[],retainManagerUserIds:Array.isArray(input.retainManagerUserIds)?input.retainManagerUserIds.filter((x):x is string=>typeof x==="string"):[],retainSalesUserIds:Array.isArray(input.retainSalesUserIds)?input.retainSalesUserIds.filter((x):x is string=>typeof x==="string"):[],idempotencyKey:key});
}

export async function mobileCancelPendingOrder(p:MobilePrincipal,raw:unknown){
 access(p);
 const parsed=z.object({action:z.literal("CANCEL_PENDING_ORDER"),orderId:z.string().guid(),confirmed:z.literal(true)}).strict().safeParse(raw);
 if(!parsed.success)throw new MobileCompanyError("INVALID_INPUT",400);
 try{await cancelPendingOrderForActor(p,parsed.data.orderId);return{ok:true};}
 catch(error){const code=error instanceof Error?error.message:"";if(code==="NOT_FOUND")throw new MobileCompanyError(code,404);if(code==="ORDER_NOT_PENDING")throw new MobileCompanyError(code,409);throw error;}
}
