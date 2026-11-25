self.addEventListener("push", event => {
 let payload;
 try { payload=event.data.json(); } catch { return; }
 const data=payload.data||{};
 if(!["BILLING_PAYMENT_CAPTURED","BILLING_RENEWAL_REMINDER"].includes(data.eventType))return;
 event.waitUntil(self.registration.showNotification("SalesPunch360",{
 body:data.eventType==="BILLING_PAYMENT_CAPTURED"?"Payment confirmed. Open Billing for details.":"Your subscription renewal is approaching.",
 tag:"billing-"+(data.orderId||data.subscriptionId||"renewal"),
 data:{url:"/workspace/billing"}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil(self.clients.openWindow("/workspace/billing"));
});
