import { MoneyAccountDirectory } from "@/components/account/money-account-directory";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string }>;
}) {
  const query = await searchParams;
  return <MoneyAccountDirectory type="BANK" query={query} />;
}
