import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { itemKinds, itemMetadataForEdit } from "@/lib/account/item-metadata";
import { ItemMetadataForm } from "./item-metadata-form";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params,
    parsed = itemKinds.safeParse(kind);
  if (!parsed.success || !z.string().guid().safeParse(id).success) notFound();
  let initial;
  try {
    initial = await itemMetadataForEdit(parsed.data, id);
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_FOUND")
      notFound();
    throw error;
  }
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`Edit ${kind === "products" ? "Product" : kind === "services" ? "Service" : "Work / Package"}`}
          backHref={`/workspace/account/${kind}`}
        />
        <p>
          Update saved item details and future tax-exclusive sale rates.
          Existing documents retain their saved amounts. Units, stock and cost
          settings remain managed separately.
        </p>
        <ItemMetadataForm kind={parsed.data} initial={initial} />
      </section>
    </main>
  );
}
