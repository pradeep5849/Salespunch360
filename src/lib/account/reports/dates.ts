/** Report dates are date-only values; April starts the financial year. */
export function reportFinancialYearStart(date = new Date()) {
  const year = date.getUTCFullYear() - (date.getUTCMonth() < 3 ? 1 : 0);
  return new Date(Date.UTC(year, 3, 1));
}
