export type SaleWarehouse = {
  id: string;
  branchId?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

/** Warehouses are branch-owned; an absent branch is not a global warehouse. */
export function defaultSaleWarehouse<T extends SaleWarehouse>(
  warehouses: readonly T[],
  branchId: string,
): T | undefined {
  const eligible = warehouses.filter(
    (warehouse) =>
      warehouse.branchId === branchId && warehouse.isActive !== false,
  );
  const defaults = eligible.filter((warehouse) => warehouse.isDefault);
  if (defaults.length === 1) return defaults[0];
  if (defaults.length === 0 && eligible.length === 1) return eligible[0];
  return undefined;
}
