"use client";
import Link from "next/link";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {createAccountItemAction} from "@/app/actions/account-masters";

type Props={units:Array<{id:string;name:string;symbol:string}>;settings:Record<string,unknown>};
export function AddItemEditor({units,settings}:Props){
 const router=useRouter(),[kind,setKind]=useState<"products"|"services">("products"),[name,setName]=useState(""),[unitId,setUnit]=useState(""),[drawer,setDrawer]=useState(false),[pending,startTransition]=useTransition();
 const enabled=(key:string)=>settings[key]!==false;
 function save(){startTransition(async()=>{await createAccountItemAction({type:kind,name:name.trim(),unitId:unitId||undefined});router.push("/workspace/account/inventory")})}
 return <main className="add-item-page"><header><Link href="/workspace/account/inventory" aria-label="Back">‹</Link><h1>Add Item</h1><button type="button" aria-label="Add item image" disabled title="Image upload unavailable">📷</button><button type="button" aria-label="Item settings" onClick={()=>setDrawer(true)}>⚙</button></header>
 <div className="account-segmented add-item-kind" aria-label="Item type">{(["products","services"] as const).map(x=><button type="button" key={x} aria-pressed={kind===x} onClick={()=>setKind(x)}>{x==="products"?"Product":"Services"}</button>)}</div>
 <section className="add-item-form"><label>Item Name *<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Enter item name"/></label>{enabled("itemUnits")&&<label>Select Unit<select value={unitId} onChange={e=>setUnit(e.target.value)}><option value="">Select Unit</option>{units.map(x=><option key={x.id} value={x.id}>{x.name} ({x.symbol})</option>)}</select></label>}</section>
 <footer><Link href="/workspace/account/inventory">Cancel</Link><button disabled={!name.trim()||pending} onClick={save}>{pending?"Saving…":"Save"}</button></footer>
 {drawer&&<div className="sale-overlay drawer"><aside className="sale-settings"><header><h2>Item Settings</h2><button onClick={()=>setDrawer(false)}>×</button></header>{[["customFields","Item Custom Fields"],["additionalFields","Additional Item Fields"],["wholesalePrice","Wholesale Price"],["barcodeScanning","Barcode Scan"],["itemCategory","Item Category"],["description","Description"]].map(([key,label])=><div className="item-setting-row" key={key}><span>{label}</span><b>{enabled(key)?"On":"Off"}</b></div>)}<div className="item-setting-row disabled"><span>Service Reminders<small>Coming Soon</small></span></div><Link className="more-settings" href="/workspace/account/inventory/item-settings">⚙ More Settings</Link></aside></div>}
 </main>
}
