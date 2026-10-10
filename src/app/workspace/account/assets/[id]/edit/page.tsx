import { updateAssetAction } from "@/app/actions/assets";
import { assetOptions, getAsset } from "@/lib/account/assets";
import { assetPageRead } from "../../page-access";
import { AssetForm } from "../../asset-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ asset }, options] = await assetPageRead(() =>
    Promise.all([getAsset(id), assetOptions()]),
  );
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>Edit {asset.assetNumber}</h1>
        <AssetForm options={options} asset={asset} action={updateAssetAction} />
      </section>
    </div>
  );
}
