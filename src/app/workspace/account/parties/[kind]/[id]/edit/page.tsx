import { z } from "zod";
import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { partyMetadataForEdit } from "@/lib/account/party-metadata";
import { PartyMetadataForm } from "./party-metadata-form";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (
    (kind !== "customers" && kind !== "vendors") ||
    !z.string().guid().safeParse(id).success
  )
    notFound();
  let data;
  try {
    data = await partyMetadataForEdit(kind, id);
  } catch (error) {
    if (error instanceof Error && error.message === "PARTY_NOT_FOUND")
      notFound();
    throw error;
  }
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={kind === "customers" ? "Edit Account Party" : "Edit Vendor"}
          backHref={`/workspace/account/${kind}`}
        />
        <p>
          Update saved contact and business details. Posted documents retain
          their original snapshots.
        </p>
        <PartyMetadataForm
          key={`${kind}:${id}`}
          kind={kind}
          initial={data.party}
          settings={data.settings}
        />
      </section>
    </main>
  );
}
