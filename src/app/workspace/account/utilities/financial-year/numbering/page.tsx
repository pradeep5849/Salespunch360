import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { numberingRestartOptions } from "@/lib/account/numbering-restart";
import { NumberingRestartForm } from "@/components/account/numbering-restart-form";
import { AccountPageHeader } from "@/components/account/account-shell";
export default async function Page() {
  const actor = await requirePermission("ACCOUNT_SETTINGS"),
    options = await numberingRestartOptions({
      ...actor,
      companyId: actor.companyId!,
    });
  return (
    <>
      <AccountPageHeader
        title="Restart future transaction numbering"
        subtitle="Preserve all business history and existing document numbers."
      />
      <Link href="/workspace/account/utilities/financial-year">
        Back to Financial Years
      </Link>
      <NumberingRestartForm options={options} />
    </>
  );
}
