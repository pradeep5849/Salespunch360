import {requirePermission} from "@/lib/auth/authorization";
import {getCustomerQuotation} from "@/lib/quotations/service";
import {QuotationThemePicker} from "@/components/account/quotation-theme-picker";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params,revision=await getCustomerQuotation(id),actor=await requirePermission("ACCOUNT_QUOTATION_VIEW");
 return <QuotationThemePicker id={id} initial={revision.printPresentation} canSave={actor.accountRole==="ACCOUNT_ADMIN"}/>;
}
