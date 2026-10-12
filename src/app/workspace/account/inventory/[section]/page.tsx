import { AccountDate } from "@/components/account/display-preferences";
import { Money } from "@/components/account/account-ui";
import { ProductPriceForm } from "@/components/account/product-price-form";
import { requirePermission } from "@/lib/auth/authorization";
import { inventoryContext } from "@/lib/account/inventory-context";
import type { ProjectActor } from "@/lib/account/projects";
import {
  inventorySnapshotForActor,
  lowStockSnapshotForActor,
} from "@/lib/account/inventory";
import { notFound } from "next/navigation";
import {
  inventoryOptions,
  listBatches,
  listInventoryProducts,
  listProductPrices,
  listSerialNumbers,
  listWarehouses,
} from "@/lib/account/inventory";
import {
  adjustmentAction,
  batchAction,
  inventoryProductAction,
  openingAction,
  serialAction,
  transferAction,
  warehouseAction,
} from "@/app/actions/inventory";
const valid = new Set([
  "items",
  "warehouses",
  "stock",
  "opening",
  "transfers",
  "adjustments",
  "low-stock",
  "batches",
]);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ branchId?: string; scope?: string; asOf?: string }>;
}) {
  const { section } = await params;
  if (!valid.has(section)) notFound();
  const o = await inventoryOptions(section);
  if (section === "warehouses") {
    const rows = await listWarehouses();
    return (
      <Shell title="Warehouses">
        <form action={warehouseAction} className="stack">
          <label>
            Branch
            <select aria-label="Branch" name="branchId" required>
              {o.branches.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <input
            aria-label="Warehouse name"
            name="name"
            placeholder="Warehouse name"
            required
          />
          <input aria-label="Code" name="code" placeholder="Code" required />
          <textarea aria-label="Address" name="address" placeholder="Address" />
          <label>
            <input
              aria-label="Default warehouse"
              type="checkbox"
              name="isDefault"
              value="true"
            />{" "}
            Default warehouse
          </label>
          <button>Create warehouse</button>
        </form>
        {rows.map((x) => (
          <article key={x.id}>
            <b>
              {x.name} ({x.code})
            </b>
            <p>
              {x.address} {x.isDefault ? "· Default" : ""} ·{" "}
              {x.isActive ? "Active" : "Inactive"}
            </p>
            {x.isActive && (
              <form action={warehouseAction}>
                <input type="hidden" name="id" value={x.id} />
                <button name="operation" value="deactivate">
                  Deactivate
                </button>
              </form>
            )}
          </article>
        ))}
      </Shell>
    );
  }
  if (section === "items") {
    const [items, prices] = await Promise.all([
      listInventoryProducts(),
      listProductPrices(),
    ]);
    return (
      <Shell title="Inventory Items">
        {items.map((x) => (
          <article key={x.id}>
            <h2>
              {x.name} {x.code && `(${x.code})`}
            </h2>
            <form action={inventoryProductAction} className="stack">
              <input type="hidden" name="productId" value={x.id} />
              <label>
                <input
                  aria-label="Track inventory"
                  type="checkbox"
                  name="trackInventory"
                  value="true"
                  defaultChecked={x.trackInventory}
                />{" "}
                Track inventory
              </label>
              <label>
                Tracking
                <select
                  aria-label="Tracking mode"
                  name="trackingMode"
                  defaultValue={x.trackingMode}
                >
                  <option>NONE</option>
                  <option>BATCH</option>
                  <option>SERIAL</option>
                </select>
              </label>
              <input
                aria-label="Barcode"
                name="barcode"
                placeholder="Barcode"
                defaultValue={x.barcode ?? ""}
              />
              <input
                aria-label="HSN code"
                name="hsnCode"
                placeholder="HSN"
                defaultValue={x.hsnCode ?? ""}
              />
              <input
                aria-label="Low stock threshold"
                name="lowStockThreshold"
                type="number"
                step="0.0001"
                defaultValue={x.lowStockThreshold.toString()}
              />
              <input
                aria-label="Purchase rate"
                name="costPrice"
                type="number"
                step="0.0001"
                placeholder="Purchase rate"
                defaultValue={x.costPrice?.toString()}
              />
              <input
                aria-label="Sales rate"
                name="salePrice"
                type="number"
                step="0.0001"
                placeholder="Sales rate"
                defaultValue={x.salePrice?.toString()}
              />
              <button>Save inventory settings</button>
            </form>
            <ProductPriceForm
              productId={x.id}
              productName={x.name}
              wholesale={o.itemSettings.wholesalePrice}
              partyWise={o.itemSettings.partyWiseRate}
              customers={o.customers}
            />

            {prices
              .filter((p) => p.productId === x.id && p.isActive)
              .map((p) => (
                <p key={p.id}>
                  {p.priceType}: <Money value={p.rate.toString()} />
                  {p.customerId && (
                    <>
                      {" "}
                      ·{" "}
                      {o.customers.find(
                        (customer) => customer.id === p.customerId,
                      )?.name ?? "Unavailable customer"}
                    </>
                  )}
                  {p.effectiveFrom && (
                    <>
                      {" "}
                      · From{" "}
                      <AccountDate
                        value={p.effectiveFrom.toISOString().slice(0, 10)}
                      />
                    </>
                  )}
                  {p.effectiveTo && (
                    <>
                      {" "}
                      · To{" "}
                      <AccountDate
                        value={p.effectiveTo.toISOString().slice(0, 10)}
                      />
                    </>
                  )}
                </p>
              ))}
          </article>
        ))}
      </Shell>
    );
  }
  if (section === "batches") {
    const [batches, serials] = await Promise.all([
      listBatches(),
      listSerialNumbers(),
    ]);
    return (
      <Shell title="Batches & Serials">
        <form action={batchAction} className="stack">
          <Product o={o} mode="BATCH" />
          <input
            aria-label="Batch number"
            name="batchNumber"
            placeholder="Batch number"
            required
          />
          <input
            aria-label="Manufactured date"
            name="manufacturedDate"
            type="date"
          />
          <input aria-label="Expiry date" name="expiryDate" type="date" />
          <button>Create batch</button>
        </form>
        <form action={serialAction} className="stack">
          <Product o={o} mode="SERIAL" />
          <input
            aria-label="Serial number"
            name="serialNumber"
            placeholder="Serial number"
            required
          />
          <input aria-label="Expiry date" name="expiryDate" type="date" />
          <button>Register serial</button>
        </form>
        {batches.map((x) => (
          <p key={x.id}>
            Batch {x.batchNumber} · Expiry{" "}
            {x.expiryDate?.toISOString().slice(0, 10) ?? "—"}
          </p>
        ))}
        {serials.map((x) => (
          <p key={x.id}>
            Serial {x.serialNumber} · Stock {x.quantity.toString()}
          </p>
        ))}
      </Shell>
    );
  }
  if (section === "stock" || section === "low-stock") {
    const query = await searchParams,
      a = await requirePermission("ACCOUNT_STOCK"),
      scoped = await inventoryContext(
        { ...a, companyId: a.companyId! } as ProjectActor,
        query,
      );
    const rows =
        section === "stock"
          ? await inventorySnapshotForActor(scoped.actor, scoped.asOf)
          : await lowStockSnapshotForActor(scoped.actor, scoped.asOf),
      products = new Map(o.products.map((x) => [x.id, x])),
      warehouses = new Map(o.warehouses.map((x) => [x.id, x]));
    return (
      <Shell title={section === "stock" ? "Stock" : "Low Stock"}>
        <p>
          {scoped.context.mode === "COMPANY"
            ? "Company consolidated"
            : scoped.context.branchName}{" "}
          · As of {query.asOf ?? "today"}. Warehouse positions with recorded
          movements; active warehouses only.
        </p>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th>Average cost</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={`${x.warehouseId}:${x.productId}`}>
                <td>{products.get(x.productId)?.name}</td>
                <td>{warehouses.get(x.warehouseId)?.name}</td>
                <td>{x.quantity.toFixed(4)}</td>
                <td>{x.averageUnitCost.toFixed(4)}</td>
                <td>{x.stockValue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Shell>
    );
  }
  const action =
    section === "opening"
      ? openingAction
      : section === "adjustments"
        ? adjustmentAction
        : transferAction;
  return (
    <Shell title={section.replaceAll("-", " ")}>
      <form action={action} className="stack">
        {section === "transfers" ? (
          <>
            <Warehouse o={o} name="sourceWarehouseId" label="Source" />
            <Warehouse
              o={o}
              name="destinationWarehouseId"
              label="Destination"
            />
          </>
        ) : (
          <Warehouse o={o} />
        )}
        <Product o={o} />
        {section === "adjustments" && (
          <select aria-label="Adjustment direction" name="direction">
            <option>IN</option>
            <option>OUT</option>
          </select>
        )}
        <input
          aria-label="Quantity"
          name="quantity"
          type="number"
          min="0.0001"
          step="0.0001"
          required
        />
        {section !== "transfers" && (
          <input
            aria-label="Unit cost"
            name="unitCost"
            type="number"
            min="0"
            step="0.0001"
            defaultValue="0"
          />
        )}
        <input
          aria-label="Movement date"
          name="movementDate"
          type="date"
          required
        />
        <select aria-label="Batch" name="batchId">
          <option value="">No batch</option>
          {o.batches.map((x) => (
            <option key={x.id} value={x.id}>
              {x.batchNumber}
            </option>
          ))}
        </select>
        <select aria-label="Serial" name="serialNumberId">
          <option value="">No serial</option>
          {o.serials.map((x) => (
            <option key={x.id} value={x.id}>
              {x.serialNumber}
            </option>
          ))}
        </select>
        {section !== "opening" && (
          <textarea
            aria-label="Reason"
            name="reason"
            placeholder="Reason"
            required
          />
        )}
        <button>Save {section}</button>
      </form>
    </Shell>
  );
}
function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>Inventory · {title}</h1>
        {children}
      </section>
    </div>
  );
}
function Product({
  o,
  mode,
}: {
  o: Awaited<ReturnType<typeof inventoryOptions>>;
  mode?: string;
}) {
  return (
    <label>
      Product
      <select aria-label="Product" name="productId" required>
        <option value="">Select</option>
        {o.products
          .filter((x) => !mode || x.trackingMode === mode)
          .map((x) => (
            <option value={x.id} key={x.id}>
              {x.name} {x.code && `(${x.code})`}
            </option>
          ))}
      </select>
    </label>
  );
}
function Warehouse({
  o,
  name = "warehouseId",
  label = "Warehouse",
}: {
  o: Awaited<ReturnType<typeof inventoryOptions>>;
  name?: string;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} name={name} required>
        <option value="">Select</option>
        {o.warehouses.map((x) => (
          <option value={x.id} key={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
}
