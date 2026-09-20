import "server-only";
import {db} from "@/lib/db";
import {env} from "@/lib/env";
import {sendTransactionalEmail} from "@/lib/email/mailer";

const SUPPORT_MOBILE="9611278818";
const money=(value:string|number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value));

export async function notifyManualPaymentOrderCreated(orderId:string){
 try{
  const order=await db.billingOrder.findUnique({where:{id:orderId},select:{id:true,status:true,billingPeriod:true,adminSeats:true,managerSeats:true,salesSeats:true,accountPackages:true,totalAmount:true,currency:true,createdAt:true,companyId:true,company:{select:{name:true,contactEmail:true,primaryPhone:true}},createdByUser:{select:{name:true,email:true,phone:true}}}});
  if(!order||order.status!=="PENDING")return;
  const [companyAdmins,superAdmins]=await Promise.all([
   db.user.findMany({where:{companyId:order.companyId,isActive:true,OR:[{role:"COMPANY_ADMIN"},{salesRole:"PRIMARY_ADMIN"},{accountRole:"ACCOUNT_ADMIN"}]},select:{email:true}}),
   db.user.findMany({where:{role:"SUPER_ADMIN",isActive:true},select:{email:true}})
  ]);
  const ref=order.id.slice(0,8).toUpperCase(),period=order.billingPeriod.replace("_"," "),total=money(order.totalAmount.toString()),accountPackages=order.accountPackages;
  const adminRecipients=[...new Set([order.createdByUser.email,order.company.contactEmail,...companyAdmins.map(x=>x.email)].filter((x):x is string=>Boolean(x)))];
  const superRecipients=[...new Set(superAdmins.map(x=>x.email).filter(Boolean))];
  const customerText=[
   `Your SalesPunch360 manual payment request has been created.`,
   `Order: ${ref}`,
   `Billing period: ${period}`,
   `Additional Admin: ${order.adminSeats}`,
   `Manager: ${order.managerSeats}`,
   `Sales: ${order.salesSeats}`,
   `Account packages: ${accountPackages}`,
   `Total: ${total}`,
   `Status: PENDING`,
   `For payment and activation, WhatsApp / call ${SUPPORT_MOBILE}.`,
   `Billing: ${new URL("/workspace/billing",env.APP_URL).toString()}`
  ].join("\n");
  const customerPhone=order.createdByUser.phone||order.company.primaryPhone||"Not provided";
  const superText=[
   `A SalesPunch360 manual payment is waiting for verification.`,
   `Company: ${order.company.name}`,
   `Order: ${ref}`,
   `Created by: ${order.createdByUser.name} <${order.createdByUser.email}>`,
   `Customer mobile: ${customerPhone}`,
   `Billing period: ${period}`,
   `Additional Admin: ${order.adminSeats}`,
   `Manager: ${order.managerSeats}`,
   `Sales: ${order.salesSeats}`,
   `Account packages: ${accountPackages}`,
   `Total: ${total}`,
   `Review pending payment: ${new URL("/admin/billing",env.APP_URL).toString()}`
  ].join("\n");
  const sends:Promise<unknown>[]=[];
  if(adminRecipients.length)sends.push(sendTransactionalEmail(adminRecipients,`SalesPunch360 payment request ${ref} received`,customerText));
  if(superRecipients.length)sends.push(sendTransactionalEmail(superRecipients,`Manual payment pending - ${order.company.name} - ${ref}`,superText));
  const results=await Promise.allSettled(sends);
  results.forEach(result=>{if(result.status==="rejected")console.error("MANUAL_PAYMENT_EMAIL_SEND_FAILED",result.reason)});
 }catch(error){console.error("MANUAL_PAYMENT_EMAIL_FAILED",error)}
}

export const manualPaymentSupportMobile=SUPPORT_MOBILE;
