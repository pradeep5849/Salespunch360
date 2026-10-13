import Link from "next/link";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { accountMasterOverview } from "@/lib/account/service";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    branchId?: string;
    scope?: string;
  }>;
}) {
  const actor = await requireAccountWorkspace(),
    query = await searchParams;
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_ACCOUNTS"))
    return (
      <section>
        <WorkspacePageHeader
          title="Account Parties"
          backHref="/workspace/account"
        />
        <p role="alert">Account parties are not available to your role.</p>
      </section>
    );
  const context = await resolveAccountBranchContext(actor, {
    branchId: query.branchId,
    scope: query.scope,
  });
  const scope: Record<string, string> =
    context.context.mode === "COMPANY"
      ? { scope: "all" }
      : { branchId: context.context.branchId };
  const data = await accountMasterOverview("customers", { ...query, ...scope });
  const href = (page: number) =>
    `?${new URLSearchParams({ ...scope, q: data.q, page: String(page) })}`;
  return (
    <section className="account-card">
      <WorkspacePageHeader
        title="Account Parties"
        backHref={`/workspace/account?tab=parties&${new URLSearchParams(scope)}`}
      />
      <p>
        Scope:{" "}
        {context.context.mode === "COMPANY"
          ? "All company branches"
          : context.context.branchName}
      </p>
      <Link
        href={`/workspace/account/customers/new?${new URLSearchParams(scope)}`}
      >
        New Party
      </Link>
      <form method="get">
        <label>
          Search parties
          <input name="q" defaultValue={data.q} maxLength={100} />
        </label>
        {Object.entries(scope).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit">Search</button>
      </form>
      {data.customers.length ? (
        <ul>
          {data.customers.map((p) => (
            <li key={p.id}>
              <h2>{p.name}</h2>
              {p.contactPerson && <p>{p.contactPerson}</p>}
              {p.phone && <p>Phone: {p.phone}</p>}
              {p.email && <p>Email: {p.email}</p>}
              {p.billingAddress && <p>{p.billingAddress}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No Account parties match this search.</p>
      )}
      <nav aria-label="Party directory pages">
        {data.page > 1 && <Link href={href(data.page - 1)}>Previous</Link>}{" "}
        {data.hasMore && <Link href={href(data.page + 1)}>Next</Link>}
      </nav>
    </section>
  );
}
