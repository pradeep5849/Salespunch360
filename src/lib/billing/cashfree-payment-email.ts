import "server-only";
import {createHash} from "node:crypto";
import { renderCashfreeReceipt } from "./cashfree-receipt";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/mailer";
import { env } from "@/lib/env";

export async function notifyCashfreePaymentCaptured(orderId:string, paymentReference:string) {
  const order = await db.billingOrder.findUnique({where:{id:orderId},include:{company:{select:{name:true,contactEmail:true}},createdByUser:{select:{email:true}},payments:{where:{status:"CAPTURED"},select:{provider:true}}}});
  if (!order || order.status !== "PAID") return;
  const [admins,superAdmins,subscription] = await Promise.all([
    db.user.findMany({where:{companyId:order.companyId,isActive:true,OR:[{role:"COMPANY_ADMIN"},{salesRole:"PRIMARY_ADMIN"},{accountRole:"ACCOUNT_ADMIN"}]},select:{email:true}}),
    db.user.findMany({where:{role:"SUPER_ADMIN",isActive:true},select:{email:true}}),
    db.companySubscription.findFirst({where:{sourceOrderId:order.id,status:"ACTIVE"},orderBy:{endsAt:"desc"}})
  ]);
  const recipients = [...new Set([order.createdByUser.email,order.company.contactEmail,...admins.map(a=>a.email),...superAdmins.map(a=>a.email)].filter((x):x is string=>Boolean(x)))];
  const sandbox = order.payments.some(p=>p.provider==="CASHFREE_SANDBOX");
  const now = new Date();
  const status = subscription ? (subscription.startsAt > now ? "Scheduled" : subscription.endsAt > now ? "Active" : "Expired") : "Payment applied; see billing for current entitlement";
  const body = [
    sandbox?"TEST PAYMENT ONLY - No real money collected.":"Payment received successfully.",
    "Company: "+order.company.name,
    "Order: "+order.id,
    "Payment reference: "+paymentReference,
    "Amount: INR "+order.totalAmount.toFixed(2),
    "Payment status: Successful",
    "Subscription: "+status,
    ...(subscription ? ["Valid from: "+subscription.startsAt.toISOString(),"Valid until: "+subscription.endsAt.toISOString()] : []),
    "Billing: "+new URL("/workspace/billing",env.APP_URL).toString()
  ].join("\n");
  const pdf = await renderCashfreeReceipt(order.id,order.companyId);
  const attachment = pdf ? {filename:(sandbox?"sandbox-receipt-":"receipt-")+order.id+".pdf",content:Buffer.from(pdf),contentType:"application/pdf"} : undefined;
  const results = await Promise.allSettled(recipients.map(async to=>{
    const key="BILLING_EMAIL_SENT:"+order.id+":"+createHash("sha256").update(to.trim().toLowerCase()).digest("hex");
    const prior=await db.fieldJob.findUnique({where:{key},select:{completedAt:true}});
    if(prior?.completedAt)return;
    await sendTransactionalEmail(to,(sandbox?"[SANDBOX] ":"")+"SalesPunch360 payment successful",body,attachment);
    await db.fieldJob.upsert({where:{key},create:{key,companyId:order.companyId,kind:"BILLING_EMAIL_SENT",payload:{orderId:order.id},completedAt:new Date()},update:{completedAt:new Date()}});
  }));
  if (results.some(r=>r.status==="rejected")) throw new Error("CASHFREE_NOTIFICATION_SEND_FAILED");
}
