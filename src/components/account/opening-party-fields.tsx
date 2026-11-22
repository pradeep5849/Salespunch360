"use client";
import {useState} from 'react';
type Options={branches:{id:string;name:string}[];customers:{id:string;name:string;branchId:string}[];vendors:{id:string;name:string}[];journals:{id:string;journalNumber:string;entryDate:string;branchId:string}[]};
export function OpeningPartyFields({options}:{options:Options}){
 const[branch,setBranch]=useState(options.branches[0]?.id??''),[type,setType]=useState('CUSTOMER');
 const parties=type==='CUSTOMER'?options.customers.filter(row=>row.branchId===branch):options.vendors;
 return <><label>Branch<select name="branchId" required value={branch} onChange={e=>setBranch(e.target.value)}>{options.branches.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
 <label>Party type<select name="partyType" value={type} onChange={e=>setType(e.target.value)}><option value="CUSTOMER">Customer opening receivable</option><option value="VENDOR">Vendor opening payable</option></select></label>
 <label>{type==='CUSTOMER'?'Customer':'Vendor'}<select key={`${branch}:${type}`} name="partyId" required defaultValue=""><option value="">Select a party</option>{parties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
 <label>Posted opening journal<select key={branch} name="journalEntryId" required defaultValue=""><option value="">Select a journal</option>{options.journals.filter(row=>row.branchId===branch).map(row=><option key={row.id} value={row.id}>{row.journalNumber} · {row.entryDate}</option>)}</select></label></>;
}
