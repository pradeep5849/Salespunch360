/** Exact preview: quantity has four decimal places, price has two. Server revalidates. */
export function assetOpeningValue(quantity: string, unitPrice: string) {
  if (
    !/^\d{1,14}(\.\d{1,4})?$/.test(quantity) ||
    !/^\d{1,16}(\.\d{1,2})?$/.test(unitPrice)
  )
    return undefined;
  const scaled = (value: string, places: number) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  const product = scaled(quantity, 4) * scaled(unitPrice, 2),
    cents =
      product / BigInt("10000") +
      (product % BigInt("10000") >= BigInt("5000") ? BigInt("1") : BigInt("0"));
  return `${cents / BigInt("100")}.${String(cents % BigInt("100")).padStart(2, "0")}`;
}
