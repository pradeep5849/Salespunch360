import { inventoryContext } from "@/lib/account/inventory-context";
import type { ProjectActor } from "@/lib/account/projects";
import { inventorySnapshotForActor } from "@/lib/account/inventory";
import { ItemsScreen } from "@/components/account/items-screen";
import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
export const metadata = { title: "Items | SalesPunch360" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string;
    scope?: string;
    type?: string;
    view?: string;
    asOf?: string;
  }>;
}) {
  const actor = await requirePermission("ACCOUNT_STOCK"),
    companyId = actor.companyId!;
  const query = await searchParams;
  const scoped = await inventoryContext(
    { ...actor, companyId } as ProjectActor,
    { branchId: query.branchId, scope: query.scope, asOf: query.asOf },
  );
  const [products, services, stock, settings, categories] = await Promise.all([
    db.accountProduct.findMany({
      where: { companyId, isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    db.accountService.findMany({
      where: { companyId, isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    inventorySnapshotForActor(scoped.actor, scoped.asOf),
    db.accountSettings.findUnique({
      where: { companyId },
      select: { itemSettings: true },
    }),
    db.accountCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const itemSettings =
    (settings?.itemSettings as {
      enabled?: boolean;
      quantityDecimals?: number;
    } | null) ?? {};
  if (itemSettings.enabled === false) notFound();
  const quantities = new Map<string, Prisma.Decimal>();
  stock.forEach((row) =>
    quantities.set(
      row.productId,
      (quantities.get(row.productId) ?? new Prisma.Decimal(0)).add(
        row.quantity,
      ),
    ),
  );
  const items = [
    ...products.map((p) => ({
      hasPhoto:!!p.photoObjectKey,
      id: p.id,
      type: "PRODUCT" as const,
      name: p.name,
      code: p.code,
      categoryId: p.categoryId,
      category: p.category?.name ?? null,
      salePrice: p.salePrice?.toString() ?? "0",
      purchasePrice: p.costPrice?.toString() ?? "0",
      stock: quantities.get(p.id)?.toString() ?? "0",
    })),
    ...services.map((s) => ({
      hasPhoto:!!s.photoObjectKey,
      id: s.id,
      type: "SERVICE" as const,
      name: s.name,
      code: s.code,
      categoryId: s.categoryId,
      category: s.category?.name ?? null,
      salePrice: s.sellingRate?.toString() ?? "0",
      purchasePrice: s.estimatedCost?.toString() ?? "0",
      stock: null,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <p>
        Company product/service catalog · Stock as of{" "}
        {scoped.asOf?.toISOString().slice(0, 10) ?? "today"}:{" "}
        {scoped.context.mode === "COMPANY"
          ? "company consolidated"
          : scoped.context.branchName}
      </p>
      <ItemsScreen
        key={`${query.view ?? "quick"}-${query.type ?? "all"}`}
        catalogMode={query.view === "catalog"}
        contextQuery={new URLSearchParams({
          ...(scoped.context.mode === "COMPANY"
            ? { scope: "all" }
            : { branchId: scoped.context.branchId }),
          ...(query.asOf ? { asOf: query.asOf } : {}),
        }).toString()}
        initialType={
          query.type === "PRODUCT" || query.type === "SERVICE"
            ? query.type
            : query.view === "catalog"
              ? "PRODUCT"
              : undefined
        }
        quantityDecimals={itemSettings.quantityDecimals ?? 2}
        canConfigure={actor.accountRole === "ACCOUNT_ADMIN"}
        items={items}
        categories={categories}
      />
    </>
  );
}
