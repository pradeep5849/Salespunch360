import { MoneyAccountForm } from "@/components/account/money-account-form";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page() {
  const d = await listMoneyData();
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Money Accounts"
          backHref="/workspace/account/money"
        />
        <MoneyAccountForm branches={d.branches} />
        <ul>
          {d.dashboard.accounts.map((x) => (
            <li key={x.id}>
              {x.name} · {x.type} · {x.balance.toFixed(2)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
