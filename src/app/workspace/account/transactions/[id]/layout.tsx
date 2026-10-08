import { redirect } from "next/navigation";
import { getCommercialDocument } from "@/lib/account/commercial";

export default async function TransactionDetailLayout({children,params}:{children:React.ReactNode;params:Promise<{id:string}>}){
  const {id}=await params;
  const document=await getCommercialDocument(id);
  if(document.type==="SALES_INVOICE")redirect(`/workspace/account/sales/${id}`);
  return children;
}
