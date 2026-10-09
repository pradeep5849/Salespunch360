import { randomUUID } from "node:crypto";
import type { Asset } from "@prisma/client";
import type { assetOptions } from "@/lib/account/assets";
import type { AccountActionResult } from "@/lib/account/action-feedback";
import { AssetEditor, type AssetEditorValue } from "./asset-editor";
type Options = Awaited<ReturnType<typeof assetOptions>>;
export function AssetForm({
  options,
  asset,
  action,
  formKey = "create",
}: {
  formKey?: string;
  options: Options;
  asset?: Asset;
  action: (f: FormData) => Promise<AccountActionResult>;
}) {
  const requestKey = randomUUID();
  const fields = asset
    ? (JSON.parse(JSON.stringify(asset)) as AssetEditorValue)
    : undefined;
  if (fields) {
    fields.purchaseDate = String(fields.purchaseDate).slice(0, 10);
    fields.depreciationStartDate = fields.depreciationStartDate
      ? String(fields.depreciationStartDate).slice(0, 10)
      : null;
    fields.effectiveDate = fields.effectiveDate
      ? String(fields.effectiveDate).slice(0, 10)
      : null;
  }
  return (
    <AssetEditor
      key={asset?.id ?? formKey}
      asset={fields}
      requestKey={requestKey}
      action={action}
      options={{
        branches: options.branches.map((x) => ({ id: x.id, name: x.name })),
        vendors: options.vendors.map((x) => ({ id: x.id, name: x.name })),
        hsnCodes: options.hsnCodes,
        ledgers: options.ledgers.map((x) => ({
          id: x.id,
          name: x.name,
          code: x.code,
          accountClass: x.accountClass,
        })),
        purchases: options.purchases.map((x) => ({
          id: x.id,
          branchId: x.branchId,
          vendorId: x.vendorId,
          documentNumber: x.documentNumber,
          partyName: x.partyName,
          lines: x.lines.map((l) => ({
            id: l.id,
            itemName: l.itemName,
            taxableAmount: l.taxableAmount.toFixed(2),
          })),
        })),
      }}
    />
  );
}
