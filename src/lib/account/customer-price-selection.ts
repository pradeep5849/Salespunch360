/** Dates are stored as DATE: compare calendar dates, including both endpoints. */
export type CustomerPriceOption = {
  id: string; productId: string; customerId: string | null; rate: string;
  effectiveFrom: string | null; effectiveTo: string | null;
};
export function customerPriceForItem(rows: readonly CustomerPriceOption[], productId: string, customerId: string, date: string) {
  if (!customerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  // Server options are ordered newest first. Preserve that deterministic precedence.
  return rows.find(row => row.productId === productId && row.customerId === customerId &&
    (!row.effectiveFrom || row.effectiveFrom <= date) && (!row.effectiveTo || row.effectiveTo >= date));
}
