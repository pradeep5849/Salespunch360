import Link from "next/link";
import { Prisma } from "@prisma/client";
import { moneyDashboard } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {
  ClientMoney,
  AccountDate,
} from "@/components/account/display-preferences";
import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string }>;
}) {
  let d: Awaited<ReturnType<typeof moneyDashboard>>;
  try {
    d = await moneyDashboard(await searchParams);
  } catch (error) {
    if (isMoneyReadScopeError(error)) return <MoneyReadUnavailable />;
    throw error;
  }
  const totals = (type: string) =>
    d.accounts
      .filter((row) => row.type === type)
      .reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
  const scopeQuery =
    d.branchContext.mode === "COMPANY"
      ? "scope=all"
      : `branchId=${d.branchContext.branchId}`;
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Cash, bank, capital & loans"
          backHref="/workspace/account"
        />
        <p>
          Scope:{" "}
          {d.branchContext.mode === "COMPANY"
            ? "All company branches"
            : d.branchContext.branchName}
        </p>
        <nav aria-label="Cash and bank navigation">
          {[
            ["bank-accounts", "Bank Accounts"],
            ["cash-in-hand", "Cash In-Hand"],
            ["accounts", "All money accounts"],
            ["transfers", "Transfers / Deposits"],
            ["cheques", "Cheques"],
            ["capital", "Capital / Drawings"],
            ["loans", "Loans / EMI"],
          ].map(([path, label]) => (
            <Link
              key={path}
              href={`/workspace/account/money/${path}${["bank-accounts", "cash-in-hand", "accounts", "transfers", "cheques"].includes(path) ? `?${scopeQuery}` : ""}`}
            >
              {label} ·{" "}
            </Link>
          ))}
        </nav>
        <div className="metric-grid">
          {[
            ["BANK", "Bank"],
            ["CASH", "Cash In-Hand"],
            ["PETTY_CASH", "Petty Cash"],
          ].map(([type, label]) => (
            <article key={type}>
              <b>{label}</b>
              <p>
                <ClientMoney value={totals(type).toFixed()} />
              </p>
            </article>
          ))}
          <article>
            <b>Active Loans</b>
            <p>{d.loans.length}</p>
          </article>
          <article>
            <b>Customer Advances</b>
            <p>
              {
                d.advances.filter((row) => row.type === "CUSTOMER_ADVANCE")
                  .length
              }
            </p>
          </article>
          <article>
            <b>Vendor Advances</b>
            <p>
              {d.advances.filter((row) => row.type === "VENDOR_ADVANCE").length}
            </p>
          </article>
        </div>
        <h2>Accounts</h2>
        <ul>
          {d.accounts.map((row) => (
            <li key={row.id}>
              {row.name} · {row.type} ·{" "}
              <ClientMoney value={row.balance.toFixed()} />
            </li>
          ))}
        </ul>
        <h2>Recent transfers</h2>
        <ul>
          {d.transfers.map((row) => (
            <li key={row.id}>
              <AccountDate value={row.transferDate.toISOString()} /> ·{" "}
              <ClientMoney value={row.amount.toFixed()} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
