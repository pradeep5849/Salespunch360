import { z } from "zod";
import { moneyReadContext } from "@/lib/account/money-context";
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
  query = {},
}: {
  type: "BANK" | "CASH";
  query?: { branchId?: string; scope?: string };
}) {
  const actor = await requirePermission("ACCOUNT_MONEY_VIEW");
  if (!actor.companyId) throw new AuthorizationError();
  let scoped;
  try {
    scoped = await moneyReadContext(
      { ...actor, companyId: actor.companyId } as ProjectActor,
      query,
    );
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof z.ZodError)
      return (
        <section className="employees-content">
          <p role="alert">
            Money accounts are unavailable for the requested branch or scope.
          </p>
          <Link href="/workspace/account/money">Return to Cash & Bank</Link>
        </section>
      );
    throw error;
  }
  const data = await moneyDashboardForActor(scoped.actor);
  const scopeQuery =
    scoped.context.mode === "COMPANY"
      ? "scope=all"
      : `branchId=${scoped.context.branchId}`;
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
          backHref={`/workspace/account/money?${scopeQuery}`}
        />
        <nav aria-label="Cash and bank sections">
          <Link
            href={`/workspace/account/money/bank-accounts?${scopeQuery}`}
            aria-current={type === "BANK" ? "page" : undefined}
          >
            Bank Accounts
          </Link>
          {" · "}
          <Link
            href={`/workspace/account/money/cash-in-hand?${scopeQuery}`}
            aria-current={type === "CASH" ? "page" : undefined}
          >
            Cash In-Hand
          </Link>
          {" · "}
          <Link href={`/workspace/account/money/accounts?${scopeQuery}`}>
            All money accounts
          </Link>
        </nav>
        <p>
          Scope:{" "}
          {scoped.context.mode === "COMPANY"
            ? "All company branches"
            : scoped.context.branchName}
        </p>
        <p>
          Total balance: <ClientMoney value={total.toFixed()} />
        </p>
        {canUsePermission(
          actor,
          "SALESPUNCH360_ACCOUNT",
          "ACCOUNT_MONEY_ENTRY",
        ) && (
          <Link
            href={`/workspace/account/money/accounts?type=${type}&${scopeQuery}`}
          >
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
