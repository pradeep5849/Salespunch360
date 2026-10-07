import { db } from "@/lib/db";

function indianFinancialYearBounds(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    name: `${startYear}-${String(endYear).slice(-2)}`,
    startDate: new Date(Date.UTC(startYear, 3, 1)),
    endDate: new Date(Date.UTC(endYear, 2, 31)),
  };
}

/**
 * Keep accounting validation authoritative, but bootstrap the normal Indian
 * Apr-Mar financial year when a company has no FY covering the sale date yet.
 * Existing closed/inactive years are never reopened automatically.
 */
export async function ensureOpenFinancialYearForDate(companyId: string, date: Date) {
  const existing = await db.financialYear.findFirst({
    where: { companyId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { startDate: "desc" },
  });
  if (existing) {
    if (!existing.isActive || existing.status !== "OPEN") throw new Error("INVALID_FINANCIAL_YEAR");
    return existing;
  }

  const bounds = indianFinancialYearBounds(date);
  const sameName = await db.financialYear.findFirst({ where: { companyId, name: bounds.name } });
  if (sameName) {
    if (!sameName.isActive || sameName.status !== "OPEN" || sameName.startDate > date || sameName.endDate < date) {
      throw new Error("INVALID_FINANCIAL_YEAR");
    }
    return sameName;
  }

  const now = new Date();
  const isCurrent = now >= bounds.startDate && now <= new Date(bounds.endDate.getTime() + 86_399_999);
  if (isCurrent) await db.financialYear.updateMany({ where: { companyId, isCurrent: true }, data: { isCurrent: false } });

  try {
    return await db.financialYear.create({
      data: {
        companyId,
        name: bounds.name,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        isCurrent,
        isActive: true,
        status: "OPEN",
      },
    });
  } catch (error) {
    // Concurrent first-post requests can race on the company/name unique key.
    const raced = await db.financialYear.findFirst({ where: { companyId, name: bounds.name } });
    if (raced?.isActive && raced.status === "OPEN" && raced.startDate <= date && raced.endDate >= date) return raced;
    throw error;
  }
}
