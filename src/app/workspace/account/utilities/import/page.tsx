import {availableTransferTypes} from "@/lib/account/transfer-access";
import { AccountCard, AccountPageHeader } from "@/components/account/account-shell";
import { ImportUploadForm } from "@/components/account/import-upload-form";
import { requirePermission } from "@/lib/auth/authorization";
export default async function Page({searchParams}:{searchParams:Promise<{type?:string}>}) {
  const actor=await requirePermission("ACCOUNT_ACCOUNTS");
  const types=(await availableTransferTypes(actor)).filter(type=>type!=="chart-of-accounts").map(type=>type.toUpperCase()).concat(actor.accountRole==="ACCOUNT_ADMIN"?["OPENING_BALANCES"]:[]);
  const requested=(await searchParams).type;
  const initialType=requested&&types.includes(requested)?requested:"CUSTOMERS";
  return <><AccountPageHeader title="Import data" subtitle="Upload → validate → preview → confirm. No business records change during preview."/><AccountCard><ImportUploadForm initialType={initialType} types={types}/></AccountCard></>;
}
