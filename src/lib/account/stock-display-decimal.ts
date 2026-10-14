const SCALE = BigInt(10000);
function units(value: string): bigint {
  if (!/^-?\d{1,64}(?:\.\d{1,4})?$/.test(value))
    throw new Error("INVALID_STOCK_DECIMAL");
  const negative = value.startsWith("-"),
    [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const amount = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));
  return negative ? -amount : amount;
}
function fixed(amount: bigint, places: number): string {
  if (!Number.isInteger(places) || places < 0 || places > 4)
    throw new Error("INVALID_DISPLAY_PRECISION");
  const magnitude = amount < 0 ? -amount : amount,
    divisor = BigInt(10) ** BigInt(4 - places);
  const rounded = (magnitude + divisor / BigInt(2)) / divisor;
  const text = rounded.toString().padStart(places + 1, "0");
  return (
    (amount < 0 && rounded !== BigInt(0) ? "-" : "") +
    (places ? `${text.slice(0, -places)}.${text.slice(-places)}` : text)
  );
}
export function stockDecimalCompare(left: string, right: string) {
  const a = units(left),
    b = units(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
export function stockDecimalFormat(value: string, places: number) {
  return fixed(units(value), places);
}
export function stockDecimalSum(values: readonly string[]) {
  return fixed(
    values.reduce((sum, value) => sum + units(value), BigInt(0)),
    4,
  );
}
