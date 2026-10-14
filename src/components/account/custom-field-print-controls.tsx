"use client";
import { useState } from "react";
import { supportsCustomFieldPrint } from "@/lib/account/custom-field-print-policy";

export function CustomFieldPrintControls({entity,defaultChecked=false}:{entity?:string;defaultChecked?:boolean}) {
 const [selected,setSelected]=useState(entity??"CUSTOMER"),[printing,setPrinting]=useState(defaultChecked);
 const supported=supportsCustomFieldPrint(selected);
 return <>
  {!entity&&<label>Entity<select aria-label="Entity" name="entityType" value={selected} onChange={event=>{setSelected(event.target.value);if(!supportsCustomFieldPrint(event.target.value))setPrinting(false)}}>{["CUSTOMER","VENDOR","PRODUCT","SERVICE","PROJECT","ASSET","QUOTATION","SALES_INVOICE","PURCHASE_BILL"].map(value=><option key={value}>{value}</option>)}</select></label>}
  <label className="account-check-label"><input name="showInPrint" type="checkbox" checked={supported&&printing} disabled={!supported} onChange={event=>setPrinting(event.target.checked)}/> Show in print</label>
  {!supported&&<p>Printing custom fields is unavailable for this entity. Saved fields remain available on its record.</p>}
 </>;
}
