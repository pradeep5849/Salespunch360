import { AccountMobileHome } from "@/components/account/account-mobile-home";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { accountMobileHomeData } from "@/lib/account/mobile-home";
export const metadata = { title: "Account home | SalesPunch360" };
// The policy-driven Menu preserves the double-entry ledger., Expenses & Other Income,
// and Cash, Bank, Capital & Loans while Home stays focused on daily mobile work.
type Query={branchId?:string;scope?:string;tab?:string;q?:string;types?:string};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){const actor=await requireAccountWorkspace(),query=await searchParams,resolved=await resolveAccountBranchContext(actor,{branchId:query.branchId,scope:query.scope}),tab=query.tab==="parties"?"parties":"transactions",data=await accountMobileHomeData(actor,resolved.context,{tab,q:query.q,types:query.types?.split(",")});return <AccountMobileHome tab={tab} transactions={data.transactions} parties={data.parties} q={data.q} selectedTypes={data.types}/>;}
