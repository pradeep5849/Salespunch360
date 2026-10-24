import Link from "next/link";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { resolvePartySettings } from "@/lib/account/party-settings";
import { db } from "@/lib/db";
import { NewAccountPartyForm } from "@/components/account/new-party-form";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string }>;
}) {
  const actor = await requireAccountWorkspace(),
    query = await searchParams;
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_ACCOUNTS"))
    return (
      <section>
        <WorkspacePageHeader title="New Party" backHref="/workspace/account" />
        <p role="alert">
          Account party creation is not available to your role.
        </p>
        <Link href="/workspace/account">Return to Home</Link>
      </section>
    );
  const context = await resolveAccountBranchContext(actor, {
    branchId: query.branchId,
    scope: query.scope,
  });
  const [fields, settings] = await Promise.all([
    db.customFieldDefinition.findMany({
      where: {
        companyId: actor.companyId,
        entityType: "CUSTOMER",
        isActive: true,
      },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    db.accountSettings.findUnique({
      where: { companyId: actor.companyId },
      select: { transactionDefaults: true },
    }),
  ]);
  const initial =
    context.context.mode === "BRANCH"
      ? context.context.branchId
      : (context.branches[0]?.id ?? "");
  return (
    <section className="account-card">
      <WorkspacePageHeader
        title="New Party"
        backHref={`/workspace/account?tab=parties&${context.context.mode === "COMPANY" ? "scope=all" : `branchId=${context.context.branchId}`}`}
      />
      <NewAccountPartyForm
        branches={context.branches}
        initialBranchId={initial}
        fields={fields}
        settings={resolvePartySettings(settings?.transactionDefaults)}
      />
    </section>
  );
}
