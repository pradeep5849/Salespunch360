"use client";
import Link from "next/link";
import { assignCustomerAction } from "@/app/actions/customers";

type Customer={id:string;name:string;phone:string|null;assignedUserId:string|null};
export function CustomerManager({customers,canManage,assignees}:{customers:Customer[];canManage:boolean;assignees:{id:string;name:string;role:string}[]}) {
 return <div>
  {canManage&&<Link className="primary-button customer-add" href="/workspace/customers/new">+ Add Customer</Link>}
  <div className="customer-grid customer-queue">
   {customers.map(c=><article key={c.id}><h2>{c.name}</h2><p>{c.phone||"No phone number"}</p>{canManage&&<form action={assignCustomerAction} className="customer-assignment"><input type="hidden" name="customerId" value={c.id}/><select name="assignedUserId" required defaultValue=""><option value="">Assign to</option>{assignees.map(u=><option key={u.id} value={u.id}>{u.name} · {u.role==="MANAGER"?"Field Manager":"Sales"}</option>)}</select><button>Assign</button></form>}</article>)}
  </div>
  {!customers.length&&<div className="empty-state">{canManage?"No unassigned customers.":"No customers are assigned to you."}</div>}
 </div>;
}
