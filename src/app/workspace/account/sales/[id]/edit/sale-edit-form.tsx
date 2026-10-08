"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replacePostedSaleAction } from "@/app/actions/sale-amendments";
import styles from "../sale-detail.module.css";

type Customer={id:string;name:string;branchId?:string};
type Item={id:string;name:string;salePrice?:string;sellingRate?:string;taxRate?:string|null;trackInventory?:boolean;kind:"PRODUCT"|"SERVICE"};
type Warehouse={id:string;branchId?:string;isDefault?:boolean};
type Line={id:string;lineType:string;sourceId?:string;itemName:string;description?:string;unitName?:string;unitSymbol?:string;quantity:string;rate:string;discountType?:string;discountValue:string;taxRate:string;cessRate:string;warehouseId?:string;batchId?:string;serialNumberId?:string};
type Initial={id:string;branchId:string;partyId:string;issueDate:string;taxMode:string;stateOfSupplyCode?:string;roundOffAmount:string;lines:Line[]};

export function SaleEditForm({initial,customers,products,services,warehouses}:{initial:Initial;customers:Customer[];products:Omit<Item,"kind">[];services:Omit<Item,"kind">[];warehouses:Warehouse[]}){
  const router=useRouter(),[pending,startTransition]=useTransition(),[error,setError]=useState("");
  const [partyId,setPartyId]=useState(initial.partyId),[issueDate,setIssueDate]=useState(initial.issueDate),[roundOff,setRoundOff]=useState(initial.roundOffAmount),[lines,setLines]=useState(initial.lines);
  const items=useMemo<Item[]>(()=>[...products.map(x=>({...x,kind:"PRODUCT" as const})),...services.map(x=>({...x,kind:"SERVICE" as const}))],[products,services]);
  const total=useMemo(()=>lines.reduce((sum,line)=>{const q=Number(line.quantity)||0,r=Number(line.rate)||0,b=q*r,d=line.discountType==="PERCENTAGE"?b*(Number(line.discountValue)||0)/100:Number(line.discountValue)||0,t=Math.max(0,b-d)*(Number(line.taxRate)||0)/100;return sum+b-d+t},0)+(Number(roundOff)||0),[lines,roundOff]);
  function patch(index:number,key:keyof Line,value:string){setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line))}
  function addItem(id:string){const item=items.find(x=>`${x.kind}:${x.id}`===id);if(!item)return;const warehouse=warehouses.find(x=>x.branchId===initial.branchId&&x.isDefault)??warehouses.find(x=>x.branchId===initial.branchId);setLines(old=>[...old,{id:`new-${Date.now()}`,lineType:item.kind,sourceId:item.id,itemName:item.name,quantity:"1",rate:String(item.kind==="PRODUCT"?item.salePrice??"0":item.sellingRate??"0"),discountType:"PERCENTAGE",discountValue:"0",taxRate:String(item.taxRate??"0"),cessRate:"0",warehouseId:item.trackInventory?warehouse?.id:undefined}])}
  function save(){if(!partyId||!lines.length){setError("Customer and at least one item are required.");return}setError("");startTransition(async()=>{try{const result=await replacePostedSaleAction(initial.id,{type:"SALES_INVOICE",branchId:initial.branchId,partyId,issueDate,taxMode:initial.taxMode,stateOfSupplyCode:initial.stateOfSupplyCode||undefined,roundOffAmount:roundOff||"0",lines:lines.map(line=>({lineType:line.lineType,sourceId:line.sourceId||undefined,itemName:line.itemName,description:line.description||undefined,unitName:line.unitName||undefined,unitSymbol:line.unitSymbol||undefined,quantity:line.quantity,rate:line.rate,discountType:line.discountType||undefined,discountValue:line.discountType?line.discountValue:undefined,taxRate:line.taxRate,cessRate:line.cessRate||"0",warehouseId:line.warehouseId||undefined,batchId:line.batchId||undefined,serialNumberId:line.serialNumberId||undefined,stockReturnQuantity:"0"}))});router.push(`/workspace/account/sales/${result.id}`);router.refresh()}catch(e){setError(e instanceof Error?e.message:"Could not edit this Sale.")}})}
  return <main className={styles.root}>
    <header className={styles.header}><button className={styles.back} onClick={()=>router.back()} aria-label="Back">←</button><h1>Edit Sale</h1><span/><span/></header>
    <section className={styles.body}>
      <div className={styles.field}><label>Date</label><input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></div>
      <div className={styles.field}><label>Customer Name *</label><select value={partyId} onChange={e=>setPartyId(e.target.value)}>{customers.filter(x=>!x.branchId||x.branchId===initial.branchId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className={styles.billedHeader}><span>⌄　Billed Items</span><span>Rate excl. tax⌄</span></div>
      {lines.map((line,index)=><article className={styles.billedCard} key={line.id}>
        <div className={styles.lineTop}><div className={styles.lineTitle}><span className={styles.lineNo}>#{index+1}</span><strong>{line.itemName}</strong></div><button type="button" onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}>×</button></div>
        <div className={styles.lineMeta}>
          <label>Qty</label><input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={e=>patch(index,"quantity",e.target.value)}/>
          <label>Rate</label><input type="number" min="0" step="0.01" value={line.rate} onChange={e=>patch(index,"rate",e.target.value)}/>
          <label>Discount %</label><input type="number" min="0" max="100" step="0.01" value={line.discountValue} onChange={e=>{patch(index,"discountType","PERCENTAGE");patch(index,"discountValue",e.target.value)}}/>
          <label>Tax %</label><input type="number" min="0" step="0.01" value={line.taxRate} onChange={e=>patch(index,"taxRate",e.target.value)}/>
        </div>
      </article>)}
      <select defaultValue="" onChange={e=>{addItem(e.target.value);e.target.value=""}}><option value="">+ Add Item</option>{items.map(item=><option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.name}</option>)}</select>
      <section className={styles.charges}><h2>Charges</h2><div className={styles.round}><span>Round Off</span><input type="number" step="0.01" value={roundOff} onChange={e=>setRoundOff(e.target.value)}/></div></section>
      <section className={styles.totals}><div className={styles.totalRow}><span>Total Amount</span><strong>₹ {total.toFixed(2)}</strong></div>{error&&<div className={styles.note}>{error}</div>}</section>
    </section>
    <footer className={styles.footer}><button className={styles.delete} onClick={()=>router.back()}>Cancel</button><button className={styles.edit} disabled={pending} onClick={save}>{pending?"Saving…":"Save Changes"}</button></footer>
  </main>
}
