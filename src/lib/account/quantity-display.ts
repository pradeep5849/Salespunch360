/** Exact decimal display only; stock movement precision is unchanged. */
export function formatStockQuantity(
  value: string,
  requestedDecimals: number,
): string {
  const decimals = Number.isFinite(requestedDecimals)
    ? Math.min(4, Math.max(0, Math.trunc(requestedDecimals)))
    : 2;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error("INVALID_STOCK_QUANTITY");
  const [, sign, whole, fraction = ""] = match;
  const padded = fraction.padEnd(decimals + 1, "0");
  let scaled = BigInt(whole + padded.slice(0, decimals));
  if (Number(padded[decimals]) >= 5) scaled += BigInt(1);
  const digits = scaled.toString().padStart(decimals + 1, "0");
  return decimals === 0
    ? `${sign}${digits}`
    : `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}
