"use client";
import {useState} from "react";
import {getApps,initializeApp} from "firebase/app";
import {getMessaging,getToken,isSupported} from "firebase/messaging";
export function WebPushButton(){
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function enable(){
  setBusy(true);
  try{
   if(!("Notification" in window)||!await isSupported())throw new Error("Browser notifications are not supported.");
   if(await Notification.requestPermission()!=="granted")throw new Error("Notification permission was not granted.");
   const response=await fetch("/api/billing/web-push/config",{cache:"no-store"});
   if(!response.ok)throw new Error("Browser notifications are not configured yet.");
   const {vapidKey,...config}=await response.json();
   const app=getApps().find(a=>a.name==="billing-push")??initializeApp(config,"billing-push");
   const registration=await navigator.serviceWorker.register("/billing-push-sw.js",{scope:"/billing-push/"});
   const worker=registration.installing||registration.waiting;
   if(!registration.active&&worker)await new Promise<void>((resolve,reject)=>{
    const check=()=>{if(worker.state==="activated")resolve();else if(worker.state==="redundant")reject(new Error("Service worker unavailable"));};
    worker.addEventListener("statechange",check);check();
   });
   const token=await getToken(getMessaging(app),{vapidKey,serviceWorkerRegistration:registration});
   if(!token)throw new Error("Browser token unavailable.");
   const saved=await fetch("/api/billing/web-push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
   if(!saved.ok)throw new Error("Notification registration failed.");
   setMessage("Billing notifications enabled.");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to enable notifications.");}
  finally{setBusy(false);}
 }
 return <div><button type="button" disabled={busy} onClick={enable} className="rounded border px-3 py-2">{busy?"Enabling…":"Enable billing notifications"}</button><p role="status">{message}</p></div>;
}
