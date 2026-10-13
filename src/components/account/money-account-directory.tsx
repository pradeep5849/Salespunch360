import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  requirePermission,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { moneyDashboardForActor } from "@/lib/account/money";
import type { ProjectActor } from "@/lib/account/projects";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ClientMoney } from "./display-preferences";
export async function MoneyAccountDirectory({
  type,
}: {
  type: "BANK" | "CASH";
}) {
  const actor = await requirePermission("ACCOUNT_MONEY_VIEW");
  if (!actor.companyId) throw new AuthorizationError();
  const data = await moneyDashboardForActor({
    ...actor,
    companyId: actor.companyId,
  } as ProjectActor);
  const rows = data.accounts.filter((row) => row.type === type),
    total = rows.reduce(
      (sum, row) => sum.add(row.balance),
      new Prisma.Decimal(0),
    );
  const title = type === "BANK" ? "Bank Accounts" : "Cash In-Hand";
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={title}
          backHref="/workspace/account/money"
        />
        <nav aria-label="Cash and bank sections">
          <Link
            href="/workspace/account/money/bank-accounts"
            aria-current={type === "BANK" ? "page" : undefined}
          >
            Bank Accounts
          </Link>
          {" · "}
          <Link
            href="/workspace/account/money/cash-in-hand"
            aria-current={type === "CASH" ? "page" : undefined}
          >
            Cash In-Hand
          </Link>
          {" · "}
          <Link href="/workspace/account/money/accounts">
            All money accounts
          </Link>
        </nav>
        <p>
          Total balance: <ClientMoney value={total.toFixed()} />
        </p>
        {canUsePermission(
          actor,
          "SALESPUNCH360_ACCOUNT",
          "ACCOUNT_MONEY_ENTRY",
        ) && (
          <Link href={`/workspace/account/money/accounts?type=${type}`}>
            {type === "BANK" ? "Add bank account" : "Add cash account"}
          </Link>
        )}
        {rows.length === 0 ? (
          <p>
            No {type === "BANK" ? "bank" : "cash"} accounts have been added.
          </p>
        ) : (
          <ul aria-label={`${title} list`}>
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.name}</strong>
                {" · "}
                <ClientMoney value={row.balance.toFixed()} />
                {!row.isActive && <span> · Inactive</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
