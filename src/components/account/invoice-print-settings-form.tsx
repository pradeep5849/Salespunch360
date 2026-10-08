"use client";
import Link from "next/link";
import {isValidElement,useMemo,useState,type ReactNode} from "react";
import {SaveFeedbackForm,SaveSubmitButton} from "./save-feedback";
import styles from "./invoice-print-settings.module.css";

export type InvoicePrintSettings=Record<string,string|number|boolean>;
type SearchableProps={"data-search"?:string};
type Props={values:InvoicePrintSettings;action:(fd:FormData)=>Promise<void>};
const bool=(v:unknown,fallback:boolean)=>typeof v==="boolean"?v:fallback;
const str=(v:unknown,fallback:string)=>typeof v==="string"?v:fallback;
const num=(v:unknown,fallback:number)=>typeof v==="number"?v:fallback;

export function InvoicePrintSettingsForm({values,action}:Props){
 const defaults=useMemo(()=>({
  printer:str(values.printer,"REGULAR"),regularDefault:bool(values.regularDefault,true),theme:str(values.theme,"REGULAR"),printTextSize:str(values.printTextSize,"MEDIUM"),pageSize:str(values.pageSize,"A4"),orientation:str(values.orientation,"PORTRAIT"),repeatHeader:bool(values.repeatHeader,true),printCompanyName:bool(values.printCompanyName,true),companyNameTextSize:str(values.companyNameTextSize,"LARGE"),companyLogo:bool(values.companyLogo,true),address:bool(values.address,true),email:bool(values.email,true),phone:bool(values.phone,true),gstinOnSale:bool(values.gstinOnSale,true),billOfSupply:bool(values.billOfSupply,false),topSpace:num(values.topSpace,0),originalDuplicate:bool(values.originalDuplicate,false),expandTable:bool(values.expandTable,true),minRows:num(values.minRows,0),totalItemQuantity:bool(values.totalItemQuantity,true),amountDecimal:bool(values.amountDecimal,true),receivedAmount:bool(values.receivedAmount,true),balanceAmount:bool(values.balanceAmount,true),partyCurrentBalance:bool(values.partyCurrentBalance,false),taxDetails:bool(values.taxDetails,true),amountGrouping:bool(values.amountGrouping,true),amountWordsFormat:str(values.amountWordsFormat,"INDIAN"),youSaved:bool(values.youSaved,true),printDescription:bool(values.printDescription,true),termsEnabled:bool(values.termsEnabled,true),termsText:str(values.termsText,""),receivedBy:bool(values.receivedBy,true),deliveredBy:bool(values.deliveredBy,true),signatureText:bool(values.signatureText,true),customSignatureText:str(values.customSignatureText,""),paymentMode:bool(values.paymentMode,true),acknowledgement:bool(values.acknowledgement,true),pageNumbers:bool(values.pageNumbers,false),transactionName:str(values.transactionName,"Sale Invoice"),itemTableColumns:str(values.itemTableColumns,"ITEM,QTY,RATE,TAX,AMOUNT")}),[values]);
 const[printer,setPrinter]=useState(defaults.printer),[topSpace,setTopSpace]=useState(defaults.topSpace),[minRows,setMinRows]=useState(defaults.minRows),[search,setSearch]=useState("");
 const rows=(items:ReactNode[])=>items.filter(Boolean);
 const toggle=(name:string,label:string,checked:boolean,info=true)=><label className={styles.row} data-search={label.toLowerCase()}><span>{label}{info&&<i title={label}>i</i>}</span><input className={styles.switch} name={name} type="checkbox" defaultChecked={checked}/></label>;
 const nav=(label:string,name:string,value:string,placeholder:string)=><label className={styles.navRow} data-search={label.toLowerCase()}><span>{label}<i>i</i></span><input name={name} defaultValue={value} placeholder={placeholder}/><b>›</b></label>;
 const section=(title:string,items:ReactNode[])=>{const visible=search.trim()?items.filter(item=>isValidElement<SearchableProps>(item)&&String(item.props["data-search"]??"").includes(search.toLowerCase())):items;return visible.length?<section className={styles.section}><h2>{title}</h2>{visible}</section>:null};
 return <SaveFeedbackForm action={action} className={styles.root}>
  <header className={styles.header}><Link href="/workspace/account/settings" aria-label="Back">←</Link><strong>Invoice Print</strong><button type="button" onClick={()=>{const q=prompt("Search Invoice Print settings",search);if(q!==null)setSearch(q.trim().toLowerCase())}} aria-label="Search">⌕</button></header>
  <div className={styles.tabs}><button type="button" className={printer==="REGULAR"?styles.active:""} onClick={()=>setPrinter("REGULAR")}>Regular</button><button type="button" className={printer==="THERMAL"?styles.active:""} onClick={()=>setPrinter("THERMAL")}>Thermal</button></div><input type="hidden" name="printer" value={printer}/>
  {toggle("regularDefault","Make Regular Printer Default",defaults.regularDefault,false)}
  {section("Themes",rows([
   nav("Change Theme and Colors","theme",defaults.theme,"Regular"),
   <label key="text" className={styles.selectRow} data-search="print text size"><span>Print text size <i>i</i></span><select name="printTextSize" defaultValue={defaults.printTextSize}><option value="SMALL">Small</option><option value="MEDIUM">Medium</option><option value="LARGE">Large</option></select></label>,
   <label key="page" className={styles.selectRow} data-search="page size"><span>Page size <i>i</i></span><select name="pageSize" defaultValue={defaults.pageSize}><option value="A4">A4 (210 × 297 mm)</option><option value="A5">A5</option><option value="THERMAL_80MM">Thermal 80 mm</option></select></label>,
   <label key="ori" className={styles.selectRow} data-search="orientation"><span>Orientation <i>i</i></span><select name="orientation" defaultValue={defaults.orientation}><option value="PORTRAIT">Portrait</option><option value="LANDSCAPE">Landscape</option></select></label>
  ]))}
  {section("Print Company Info/Header",rows([
   toggle("repeatHeader","Print repeat header in all pages",defaults.repeatHeader),toggle("printCompanyName","Print Company Name",defaults.printCompanyName),
   <label key="csize" className={styles.selectRow} data-search="company name text size"><span>Company Name Text Size <i>i</i></span><select name="companyNameTextSize" defaultValue={defaults.companyNameTextSize}><option value="SMALL">Small</option><option value="MEDIUM">Medium</option><option value="LARGE">Large</option></select></label>,
   toggle("companyLogo","Company logo",defaults.companyLogo),toggle("address","Address",defaults.address),toggle("email","Email",defaults.email),toggle("phone","Phone number",defaults.phone),toggle("gstinOnSale","GSTIN on Sale",defaults.gstinOnSale),toggle("billOfSupply","Print Bill of Supply for non tax invoices",defaults.billOfSupply),
   <label key="top" className={styles.stepRow} data-search="extra spaces on top of pdf"><span>Extra spaces on top of PDF <i>i</i></span><button type="button" onClick={()=>setTopSpace(Math.max(0,topSpace-1))}>−</button><output>{topSpace}</output><input type="hidden" name="topSpace" value={topSpace}/><button type="button" onClick={()=>setTopSpace(Math.min(20,topSpace+1))}>+</button></label>,
   toggle("originalDuplicate","Print Original/Duplicate",defaults.originalDuplicate),nav("Change Transaction Names","transactionName",defaults.transactionName,"Sale Invoice")
  ]))}
  {section("Totals & Taxes",rows([
   toggle("expandTable","Expand table to print on whole page",defaults.expandTable),
   <label key="rows" className={styles.stepRow} data-search="min no of rows in item table"><span>Min. No. of rows in Item Table <i>i</i></span><button type="button" onClick={()=>setMinRows(Math.max(0,minRows-1))}>−</button><output>{minRows}</output><input type="hidden" name="minRows" value={minRows}/><button type="button" onClick={()=>setMinRows(Math.min(50,minRows+1))}>+</button></label>,
   nav("Item Table Customization","itemTableColumns",defaults.itemTableColumns,"ITEM,QTY,RATE,TAX,AMOUNT"),toggle("totalItemQuantity","Total Item Quantity",defaults.totalItemQuantity),toggle("amountDecimal","Amount with Decimal(eg 0.00)",defaults.amountDecimal),toggle("receivedAmount","Received amount",defaults.receivedAmount),toggle("balanceAmount","Balance amount",defaults.balanceAmount),toggle("partyCurrentBalance","Print Current Balance of Party",defaults.partyCurrentBalance),toggle("taxDetails","Tax details",defaults.taxDetails),toggle("amountGrouping","Amount Grouping",defaults.amountGrouping),
   <label key="words" className={styles.selectRow} data-search="amount in words format"><span>Amount in words format <i>i</i></span><select name="amountWordsFormat" defaultValue={defaults.amountWordsFormat}><option value="INDIAN">Indian Eg 1,00,00,000</option><option value="INTERNATIONAL">International Eg 10,000,000</option></select></label>,toggle("youSaved","You Saved",defaults.youSaved)
  ]))}
  {section("Footer",rows([
   toggle("printDescription","Print description",defaults.printDescription),toggle("termsEnabled","Terms & Conditions",defaults.termsEnabled),nav("Set Terms & Conditions","termsText",defaults.termsText,"Enter terms & conditions"),toggle("receivedBy","Print Received by details",defaults.receivedBy),toggle("deliveredBy","Print Delivered by details",defaults.deliveredBy),toggle("signatureText","Print Signature Text",defaults.signatureText),nav("Set Custom Signature Text","customSignatureText",defaults.customSignatureText,"Authorized Signatory"),toggle("paymentMode","Payment mode",defaults.paymentMode),toggle("acknowledgement","Print Acknowledgement",defaults.acknowledgement),toggle("pageNumbers","Print Page Numbers",defaults.pageNumbers)
  ]))}
  <div className={styles.save}><SaveSubmitButton className="account-primary">Save Invoice Print Settings</SaveSubmitButton></div>
 </SaveFeedbackForm>;
}
