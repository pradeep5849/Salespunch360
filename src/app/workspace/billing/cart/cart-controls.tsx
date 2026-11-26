"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function CartControls({selection,revision,remove=false}:{selection?:Record<string,unknown>;revision?:number;remove?:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function save(){setBusy(true);setError("");try{
 const current=await fetch("/api/billing/cart",{cache:"no-store"});if(!current.ok)throw new Error("Unable to load cart.");
 const cart=await current.json();
 if(!remove&&cart.selection&&JSON.stringify(cart.selection)!==JSON.stringify(selection)&&!window.confirm("Replace the existing subscription selection in your cart?"))return;
 const response=await fetch("/api/billing/cart",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revision??cart.revision,selection:remove?null:selection})});
 if(!response.ok)throw new Error(response.status===409?"Cart changed on another device. Refresh and try again.":"Unable to save cart.");
 router.push("/workspace/billing/cart");router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Cart request failed.");}finally{setBusy(false);}}
 return <div><button type="button" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":remove?"Remove selection":"Add to cart"}</button>{error&&<p role="alert">{error}</p>}</div>;
}
