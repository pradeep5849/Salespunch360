import { randomUUID } from "node:crypto";
import { MoneyAccountForm } from "@/components/account/money-account-form";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const query = await searchParams,
    initialType =
      query.type === "CASH"
        ? "CASH"
        : query.type === "PETTY_CASH"
          ? "PETTY_CASH"
          : "BANK";
  const d = await listMoneyData();
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Money Accounts"
          backHref="/workspace/account/money"
        />
        {d.capabilities.postMoneyEntries ? (
          <MoneyAccountForm
            branches={d.branches}
            initialType={initialType}
            creationRequestKey={randomUUID()}
          />
        ) : (
          <p>Creating money accounts requires Money Entry permission.</p>
        )}
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
