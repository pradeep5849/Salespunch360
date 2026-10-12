import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { OwnerForms } from "./owner-forms";
export default async function Page() {
  const data = await listMoneyData();
  return (
    <section className="employees-shell">
      <div className="employees-content">
        <WorkspacePageHeader
          title="Capital & Drawings"
          backHref="/workspace/account/money"
        />
        <OwnerForms
          owners={data.owners}
          users={data.users}
          branches={data.branches}
          accounts={data.dashboard.accounts.map((account) => ({
            id: account.id,
            name: account.name,
            balance: account.balance.toFixed(2),
          }))}
          canManage={data.capabilities.manageOwners}
          canPost={data.capabilities.postOwnerTransactions}
        />
      </div>
    </section>
  );
}
