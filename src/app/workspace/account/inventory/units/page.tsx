import { assertUnitAccess } from "@/lib/account/units";
import type { ProjectActor } from "@/lib/account/projects";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { UnitsManager } from "@/components/account/units-manager";
export const metadata = { title: "Units | SalesPunch360" };
export default async function Page() {
  const actor = await requirePermission("ACCOUNT_STOCK"),
    companyId = actor.companyId!;
  try {
    await assertUnitAccess(actor as ProjectActor);
  } catch (error) {
    if (error instanceof AuthorizationError)
      return (
        <div role="alert">
          Units are unavailable for your permissions or Item settings.
        </div>
      );
    throw error;
  }
  const [units, settings] = await Promise.all([
    db.accountUnit.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        symbol: true,
        _count: { select: { products: true, services: true } },
      },
    }),
    db.accountSettings.findUnique({
      where: { companyId },
      select: { itemSettings: true },
    }),
  ]);
  const itemSettings = (settings?.itemSettings ?? {}) as {
    unitConversions?: Array<{
      baseUnitId: string;
      secondaryUnitId: string;
      rate: string | number;
    }>;
  };
  return (
    <UnitsManager
      units={units.map((x) => ({
        id: x.id,
        name: x.name,
        symbol: x.symbol,
        itemCount: x._count.products + x._count.services,
      }))}
      conversions={itemSettings.unitConversions ?? []}
    />
  );
}
