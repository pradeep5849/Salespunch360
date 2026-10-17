import { Money } from "@/components/account/account-ui";
import Link from "next/link";
import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
import { randomUUID } from "node:crypto";
import { MoneyAccountForm } from "@/components/account/money-account-form";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; branchId?: string; scope?: string }>;
}) {
  const query = await searchParams,
    initialType =
      query.type === "CASH"
        ? "CASH"
        : query.type === "PETTY_CASH"
          ? "PETTY_CASH"
          : "BANK";
  let d: Awaited<ReturnType<typeof listMoneyData>>;
  try {
    d = await listMoneyData({ branchId: query.branchId, scope: query.scope });
  } catch (error) {
    if (isMoneyReadScopeError(error)) return <MoneyReadUnavailable />;
    throw error;
  }
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
        <p>
          Scope:{" "}
          {d.branchContext.mode === "COMPANY"
            ? "All company branches"
            : d.branchContext.branchName}
        </p>
        <ul>
          {d.dashboard.accounts.map((x) => (
            <li key={x.id}>
              <Link
                href={`/workspace/account/money/accounts/${x.id}?${d.branchContext.mode === "COMPANY" ? "scope=all" : `branchId=${d.branchContext.branchId}`}`}
              >
                {x.name}
              </Link>{" "}
              · {x.type} · <Money value={x.balance} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
