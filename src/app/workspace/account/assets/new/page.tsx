import { createAssetAction } from "@/app/actions/assets";
import { assetOptions } from "@/lib/account/assets";
import { assetPageRead } from "../page-access";
import { AssetForm } from "../asset-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>New asset</h1>
        <AssetForm
          options={await assetPageRead(assetOptions)}
          action={createAssetAction}
          formKey={saved ?? "create"}
        />
      </section>
    </div>
  );
}
