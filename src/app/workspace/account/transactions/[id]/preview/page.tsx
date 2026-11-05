import {getCommercialDocument} from "@/lib/account/commercial";
import {PaymentPreview} from "@/components/account/payment-preview";
export default async function Page({params}:{params:Promise<{id:string}>}){const row=await getCommercialDocument((await params).id);return <><p>{row.status === "DRAFT"?"Saved draft preview. This document has not been posted.":row.status}</p><PaymentPreview id={row.id} type={row.type} number={row.documentNumber} label="Transaction preview" backHref={`/workspace/account/transactions/${row.id}`}/></>;}
