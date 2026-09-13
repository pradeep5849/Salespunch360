"use client";
import Link from "next/link";
import { assignCustomerAction } from "@/app/actions/customers";
import {assigneesForBranch} from "@/lib/customers/options";

type Customer={id:string;branchId:string;name:string;phone:string|null;assignedUserId:string|null};type Assignee={id:string;name:string;salesRole:string|null;branchAccessScope:string;branchAccesses:{branchId:string}[]};
export function CustomerManager({customers,canManage,assignees}:{customers:Customer[];canManage:boolean;assignees:Assignee[]}) {
 return <div>
  {canManage&&<Link className="primary-button customer-add" href="/workspace/customers/new">+ Add Customer</Link>}
  <div className="customer-grid customer-queue">
   {customers.map(c=>{const eligible=assigneesForBranch(assignees,c.branchId);return <article key={c.id}><h2>{c.name}</h2><p>{c.phone||"No phone number"}</p>{canManage&&<form action={assignCustomerAction} className="customer-assignment"><input type="hidden" name="customerId" value={c.id}/><select name="assignedUserId" required defaultValue=""><option value="">Assign to</option>{eligible.map(u=><option key={u.id} value={u.id}>{u.name} · {u.salesRole==="MANAGER"?"Field Manager":"Sales"}</option>)}</select><button>Assign</button></form>}</article>})}
  </div>
  {!customers.length&&<div className="empty-state">{canManage?"No unassigned customers.":"No customers are assigned to you."}</div>}
 </div>;
}
