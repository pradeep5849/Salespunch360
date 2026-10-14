import { db } from "@/lib/db";

/** Company-owned codes only; this is not an official tax classification catalogue. */
export async function savedHsnCodes(companyId: string) {
  const [products, services] = await Promise.all([
    db.accountProduct.findMany({
      where: { companyId, isActive: true, hsnCode: { not: null } },
      select: { hsnCode: true },
      distinct: ["hsnCode"],
      orderBy: { hsnCode: "asc" },
    }),
    db.accountService.findMany({
      where: { companyId, isActive: true, sacCode: { not: null } },
      select: { sacCode: true },
      distinct: ["sacCode"],
      orderBy: { sacCode: "asc" },
    }),
  ]);
  return [
    ...new Set(
      [...products.map((p) => p.hsnCode), ...services.map((s) => s.sacCode)]
        .map((code) => code?.trim())
        .filter((code): code is string => Boolean(code)),
    ),
  ].sort();
}
