import {
  MaterialTreatment,
  Prisma,
  PurchaseAllocationType,
  PurchasePurpose,
} from "@prisma/client";
const D = Prisma.Decimal;
export type PurchaseAllocationRequest = {
  allocationType: PurchaseAllocationType;
  quantity: string | number;
  projectId?: string;
  projectBudgetLineId?: string;
  warehouseId?: string;
  materialTreatment?: MaterialTreatment;
};
type Money = {
  baseAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  cessAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};
function distribute(
  total: Prisma.Decimal,
  quantities: Prisma.Decimal[],
  sum: Prisma.Decimal,
) {
  let used = new D(0);
  return quantities.map((q, i) => {
    const value =
      i === quantities.length - 1
        ? total.sub(used)
        : total.mul(q).div(sum).toDecimalPlaces(2);
    used = used.add(value);
    return value;
  });
}
export function defaultAllocationType(
  purpose: PurchasePurpose,
  treatment?: MaterialTreatment | null,
): PurchaseAllocationType {
  if (
    purpose === "INVENTORY_SALES" ||
    (purpose === "PROJECT" && treatment === "RECEIVE_IN_INVENTORY")
  )
    return "INVENTORY";
  if (purpose === "GENERAL_OFFICE" || purpose === "OFFICE")
    return "GENERAL_EXPENSE";
  if (purpose === "FIXED_ASSET") return "FIXED_ASSET";
  if (purpose === "PROJECT") return "PROJECT";
  throw new Error("MIXED_ALLOCATIONS_REQUIRED");
}
export function buildPurchaseAllocations(input: {
  purpose: PurchasePurpose;
  treatment?: MaterialTreatment | null;
  quantity: Prisma.Decimal;
  money: Money;
  requests?: PurchaseAllocationRequest[];
  documentProjectId?: string;
  documentBudgetLineId?: string;
  warehouseId?: string;
}) {
  let requests = input.requests ?? [];
  if (input.purpose !== "MIXED") {
    if (requests.length) throw new Error("ALLOCATIONS_ONLY_FOR_MIXED");
    const type = defaultAllocationType(input.purpose, input.treatment);
    requests = [
      {
        allocationType: type,
        quantity: input.quantity.toString(),
        ...(type === "PROJECT"
          ? {
              projectId: input.documentProjectId,
              projectBudgetLineId: input.documentBudgetLineId,
              materialTreatment: input.treatment ?? undefined,
            }
          : {}),
        warehouseId: input.warehouseId,
      },
    ];
  }
  if (!requests.length) throw new Error("MIXED_ALLOCATIONS_REQUIRED");
  const quantities = requests.map((x) => new D(x.quantity));
  if (quantities.some((x) => x.lte(0)))
    throw new Error("INVALID_ALLOCATION_QUANTITY");
  const sum = quantities.reduce((n, x) => n.add(x), new D(0));
  if (!sum.eq(input.quantity))
    throw new Error(
      sum.lt(input.quantity)
        ? "ALLOCATION_UNDER_ALLOCATED"
        : "ALLOCATION_OVER_ALLOCATED",
    );
  const keys = requests.map((x) =>
    [
      x.allocationType,
      x.projectId ?? "",
      x.projectBudgetLineId ?? "",
      x.warehouseId ?? "",
      x.materialTreatment ?? "",
    ].join(":"),
  );
  if (new Set(keys).size !== keys.length)
    throw new Error("DUPLICATE_PURCHASE_ALLOCATION");
  for (const row of requests) {
    if (
      row.allocationType === "PROJECT" &&
      (!row.projectId || !row.projectBudgetLineId)
    )
      throw new Error("PROJECT_ALLOCATION_INCOMPLETE");
    if (
      row.allocationType !== "PROJECT" &&
      (row.projectId || row.projectBudgetLineId || row.materialTreatment)
    )
      throw new Error("PROJECT_FIELDS_ON_NON_PROJECT_ALLOCATION");
    if (row.allocationType === "INVENTORY" && !row.warehouseId)
      throw new Error("ALLOCATION_WAREHOUSE_REQUIRED");
  }
  const fields = [
      "baseAmount",
      "discountAmount",
      "taxableAmount",
      "taxAmount",
      "cessAmount",
      "lineTotal",
    ] as const,
    parts = Object.fromEntries(
      fields.map((k) => [k, distribute(input.money[k], quantities, sum)]),
    ) as Record<(typeof fields)[number], Prisma.Decimal[]>;
  return requests.map((row, position) => ({
    ...row,
    position,
    quantity: quantities[position],
    baseAmount: parts.baseAmount[position],
    discountAmount: parts.discountAmount[position],
    taxableAmount: parts.taxableAmount[position],
    taxAmount: parts.taxAmount[position],
    cessAmount: parts.cessAmount[position],
    totalAmount: parts.lineTotal[position],
  }));
}
