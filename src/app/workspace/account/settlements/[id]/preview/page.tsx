import {notFound} from "next/navigation";
import {requirePermission} from "@/lib/auth/authorization";
import {homeSettlementForActor} from "@/lib/account/home-settlement";
import {PaymentPreview} from "@/components/account/payment-preview";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ACCOUNT_LEDGER_VIEW"),{id}=await params;
 const data=await homeSettlementForActor({...actor,companyId:actor.companyId!},id);if(!data)notFound();
 return <PaymentPreview id={id} type={data.entry.type} number={data.entry.documentNumber} preferredShareAs={data.shareAs} canEditPrintSettings={actor.accountRole==="ACCOUNT_ADMIN"}/>;
}
