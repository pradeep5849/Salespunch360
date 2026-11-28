import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";

export async function renderCashfreeReceipt(orderId:string,companyId:string) {
 const order=await db.billingOrder.findFirst({where:{id:orderId,companyId,status:"PAID"},include:{payments:true}});
 const payment=order?.payments.find(p=>["CASHFREE","CASHFREE_SANDBOX"].includes(p.provider)&&p.status==="CAPTURED");
 if(!order||!payment)return null;
 const pdf=await PDFDocument.create();
 const page=pdf.addPage([595,842]);
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 page.drawText("SalesPunch360",{x:48,y:780,size:24,font:bold});
 page.drawText(payment.provider==="CASHFREE_SANDBOX"?"SANDBOX PAYMENT RECEIPT":"PAYMENT RECEIPT",{x:48,y:735,size:18,font:bold,color:rgb(0.7,0.1,0.1)});
 const lines=[payment.provider==="CASHFREE_SANDBOX"?"TEST ONLY - Not a tax invoice. No real money collected.":"Payment acknowledgement - Not a tax invoice.","Order: "+order.id,"Payment: "+payment.providerPaymentId,"Amount: INR "+payment.amount.toFixed(2),payment.provider==="CASHFREE_SANDBOX"?"Status: CAPTURED (TEST)":"Status: CAPTURED","Paid at: "+(payment.capturedAt?.toISOString()??"Unavailable"),"Billing period: "+order.billingPeriod,"Additional admins: "+order.adminSeats,"Managers: "+order.managerSeats,"Sales seats: "+order.salesSeats,"Account packages: "+order.accountPackages,"www.salespunch360.com"];
 lines.forEach((line,i)=>page.drawText(line,{x:48,y:690-i*25,size:11,font}));
 return new Uint8Array(await pdf.save());
}
