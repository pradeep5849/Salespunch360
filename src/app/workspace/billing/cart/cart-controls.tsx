"use client";
import {useState,useEffect} from "react";
import styles from "./cart.module.css";
import {useRouter} from "next/navigation";
export default function CartControls({selection,revision,remove=false,edit=false}:{selection?:Record<string,unknown>;revision?:number;remove?:boolean;edit?:boolean}){
 const [draft,setDraft]=useState(selection??{});const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const dirty=edit&&JSON.stringify(draft)!==JSON.stringify(selection);
 useEffect(()=>{if(!edit)return;const link=document.querySelector<HTMLAnchorElement>("[data-cart-checkout]");if(!link)return;link.setAttribute("aria-disabled",String(dirty||busy));const block=(e:Event)=>{if(dirty||busy)e.preventDefault();};link.addEventListener("click",block);return()=>{link.removeEventListener("click",block);link.removeAttribute("aria-disabled");};},[dirty,busy,edit]);
 async function save(){setBusy(true);setError("");try{
 const current=await fetch("/api/billing/cart",{cache:"no-store"});if(!current.ok)throw new Error("Unable to load cart.");
 const cart=await current.json();
 if(!edit&&!remove&&cart.selection&&JSON.stringify(cart.selection)!==JSON.stringify(selection)&&!window.confirm("Replace the existing subscription selection in your cart?"))return;
 const response=await fetch("/api/billing/cart",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revision??cart.revision,selection:remove?null:edit?draft:selection})});
 if(!response.ok)throw new Error(response.status===409?"Cart changed on another device. Refresh and try again.":"Unable to save cart.");
 router.push("/workspace/billing/cart");router.refresh();
 }catch(e){setError(e instanceof Error?e.message:"Cart request failed.");}finally{setBusy(false);}}
 return <div className={edit?styles.quantities:undefined}>{edit&&Object.keys(draft).filter(k=>draft.kind==="ACCOUNT_PACKAGE"?k==="quantity":["adminSeats","managerSeats","salesSeats","telecallerSeats","accountPackages"].includes(k)).map(k=><label key={k} className={styles.quantity}>{({adminSeats:"Admin",managerSeats:"Manager",salesSeats:"Sales",telecallerSeats:"Telecaller",accountPackages:"Account packages",quantity:"Packages"} as Record<string,string>)[k]}<span className={styles.stepper}><button type="button" aria-label={"Decrease "+k} disabled={busy||Number(draft[k])<=(k==="quantity"?1:0)} onClick={()=>setDraft({...draft,[k]:Math.max(k==="quantity"?1:0,Number(draft[k])-1)})}>−</button><input aria-label={k} type="number" min={k==="quantity"?1:0} max={k==="quantity"||k==="accountPackages"?100:10000} value={Number(draft[k])} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/><button type="button" aria-label={"Increase "+k} disabled={busy||Number(draft[k])>=(k==="quantity"||k==="accountPackages"?100:10000)} onClick={()=>setDraft({...draft,[k]:Number(draft[k])+1})}>+</button></span></label>)}<button className={remove?styles.remove:!edit?`button-link ${styles.checkout}`:"button-link"} type="button" disabled={busy||(edit&&!dirty)} onClick={()=>void save()}>{busy?"Saving…":remove?"Remove selection":edit?"Update cart":"Add to Cart"}</button>{dirty&&<p role="status">Save your changes before checkout.</p>}{error&&<p role="alert">{error}</p>}</div>;
}
