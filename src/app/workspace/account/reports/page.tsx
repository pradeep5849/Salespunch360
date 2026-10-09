import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { z } from "zod";
const reports = [
  "profit-loss",
  "balance-sheet",
  "trial-balance",
  "cash-flow",
  "general-ledger",
  "customer-ledger",
  "vendor-ledger",
  "receivable-aging",
  "payable-aging",
  "cash-bank",
  "owner-capital",
  "projects",
  "branches",
  "items",
  "invoices",
  "customers",
  "tax",
  "budget-vs-actual",
];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const a = await requirePermission("ACCOUNT_REPORTS"),
    q = await searchParams;
  const { context } = await resolveAccountBranchContext(
    { ...a, companyId: a.companyId! },
    q,
  );
  const query = new URLSearchParams(
    context.mode === "BRANCH"
      ? { branchId: context.branchId }
      : { scope: "all" },
  );
  for (const name of ["from", "to", "asOf"] as const)
    if (q[name]) query.set(name, z.string().date().parse(q[name]));
  if (q.from && q.to && q.from > q.to)
    throw new Error("Report start date must precede its end date.");
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>
          {a.accountRole === "PROJECT_MANAGER"
            ? "Project reports"
            : "Financial Reports"}
        </h1>
        <p>
          Scope:{" "}
          {context.mode === "COMPANY"
            ? "Company consolidated"
            : context.branchName}
          .{" "}
          {q.from && q.to
            ? `${q.from} to ${q.to}.`
            : "Choose report dates in the report."}{" "}
          Project costing reports are lifetime-to-date.
        </p>
        <nav className="employee-actions">
          {(a.accountRole === "PROJECT_MANAGER" ? ["projects"] : reports).map(
            (x) => (
              <Link key={x} href={`/workspace/account/reports/${x}?${query}`}>
                {x.replaceAll("-", " ")}
              </Link>
            ),
          )}
        </nav>
        <Link href="/workspace/account/reports">
          Reset dates and choose current workspace scope
        </Link>
      </section>
    </div>
  );
}
