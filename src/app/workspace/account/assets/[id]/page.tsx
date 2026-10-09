import Link from "next/link";
import { assetPageRead } from "../page-access";
import { assetOptions, getAsset } from "@/lib/account/assets";
import { AssetLifecycleControls } from "../asset-lifecycle-controls";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    data = await assetPageRead(() => getAsset(id)),
    { asset, history, events, people } = data,
    options = await assetPageRead(assetOptions);
  const eligibleUsers = options.users.filter(
      (x) =>
        x.branchAccessScope === "ALL_BRANCHES" ||
        x.branchAccesses.some((b) => b.branchId === asset.branchId),
    ),
    names = new Map(people.map((x) => [x.id, x.name]));
  const details: [string, string | number | null | undefined][] = [
    ["Asset type", asset.assetType],
    ["Status", asset.status],
    ["Purchase value", `₹${asset.purchaseValue.toFixed(2)}`],
    ["Purchase date", asset.purchaseDate.toISOString().slice(0, 10)],
    ["Category", asset.category],
    ["HSN code", asset.hsnCode],
    ["Opening quantity", asset.openingQuantity?.toString()],
    ["Price per unit", asset.unitPrice?.toFixed(2)],
    ["Effective date", asset.effectiveDate?.toISOString().slice(0, 10)],
    [
      "Vendor",
      options.vendors.find((x) => x.id === asset.vendorId)?.name ??
        asset.vendorId,
    ],
    [
      "Purchase bill",
      options.purchases.find((x) => x.id === asset.purchaseDocumentId)
        ?.documentNumber ?? asset.purchaseDocumentId,
    ],
    [
      "Purchase line",
      options.purchases
        .flatMap((x) => x.lines)
        .find((x) => x.id === asset.purchaseDocumentLineId)?.itemName ??
        asset.purchaseDocumentLineId,
    ],
    ["Serial number", asset.serialNumber],
    ["Registration number", asset.registrationNumber],
    ["Make / model", asset.makeModel],
    ["Manufacture year", asset.manufactureYear],
    ["Location", asset.location],
    ["Description", asset.description],
    ["Depreciation method", asset.depreciationMethod],
    ["Useful life (months)", asset.usefulLifeMonths],
    ["Salvage value", asset.salvageValue.toFixed(2)],
    [
      "Depreciation start date",
      asset.depreciationStartDate?.toISOString().slice(0, 10),
    ],
    [
      "Asset ledger",
      options.ledgers.find((x) => x.id === asset.assetLedgerId)?.name ??
        asset.assetLedgerId,
    ],
    [
      "Accumulated depreciation ledger",
      options.ledgers.find(
        (x) => x.id === asset.accumulatedDepreciationLedgerId,
      )?.name ?? asset.accumulatedDepreciationLedgerId,
    ],
    [
      "Depreciation expense ledger",
      options.ledgers.find((x) => x.id === asset.depreciationExpenseLedgerId)
        ?.name ?? asset.depreciationExpenseLedgerId,
    ],
  ];
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>
          {asset.assetNumber} · {asset.name}
        </h1>
        <dl>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "Not set"}</dd>
            </div>
          ))}
        </dl>
        <p>
          Assigned to:{" "}
          {asset.assignedUserId
            ? (names.get(asset.assignedUserId) ?? "Unavailable employee")
            : "Unassigned"}
        </p>
        <Link href={`/workspace/account/assets/${id}/edit`}>Edit asset</Link>
        <AssetLifecycleControls
          key={`${asset.status}-${asset.assignedUserId ?? ""}`}
          id={id}
          status={asset.status}
          users={eligibleUsers.map((x) => ({ id: x.id, name: x.name }))}
        />
        <h2>Assignment history</h2>
        {!history.length && <p>No assignments yet.</p>}
        {history.map((x) => (
          <article key={x.id}>
            <p>
              {names.get(x.assignedToId) ?? "Unavailable employee"} · Assigned
              by {names.get(x.assignedById) ?? "Unavailable user"}
            </p>
            <p>
              {x.assignedAt.toISOString()} —{" "}
              {x.returnedAt?.toISOString() ?? "Current assignment"}
            </p>
            {x.notes && <p>Assignment notes: {x.notes}</p>}
          </article>
        ))}
        <h2>Lifecycle history</h2>
        {events.map((x) => (
          <article key={x.id}>
            <p>
              {x.eventType.replaceAll("_", " ")} ·{" "}
              {names.get(x.actorUserId) ?? "Unavailable user"} ·{" "}
              {x.createdAt.toISOString()}
            </p>
            {x.metadata && (
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {assetEventDescription(x.metadata, names)}
              </pre>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function assetEventDescription(metadata: unknown, names: Map<string, string>) {
  const m = metadata as {
    fromStatus?: string;
    status?: string;
    userId?: string;
    returnNotes?: string;
  };
  return [
    m.fromStatus && m.status ? `${m.fromStatus} → ${m.status}` : m.status,
    m.userId
      ? `Assigned to ${names.get(m.userId) ?? "Unavailable employee"}`
      : null,
    m.returnNotes ? `Return notes: ${m.returnNotes}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
