export type ReceiptLink = { target: string; amount: string };
export function receiptCents(value: string): bigint | null {
  return /^\d{1,16}(\.\d{1,2})?$/.test(value)
    ? BigInt(value.split(".")[0]) * BigInt(100) +
        BigInt((value.split(".")[1] ?? "").padEnd(2, "0"))
    : null;
}
export function receiptLinkReview(
  received: string,
  links: ReceiptLink[],
  outstanding: Map<string, string>,
) {
  const amount = receiptCents(received);
  if (amount === null || amount <= BigInt(0))
    return {
      error: "Enter a positive received amount with up to two decimals.",
      unused: BigInt(0),
    };
  let linked = BigInt(0);
  const seen = new Set<string>();
  for (const row of links) {
    const value = receiptCents(row.amount),
      limit = receiptCents(outstanding.get(row.target) ?? "");
    if (
      seen.has(row.target) ||
      value === null ||
      value <= BigInt(0) ||
      limit === null ||
      value > limit
    )
      return {
        error:
          "Each selected invoice needs one positive link amount within its outstanding balance.",
        unused: amount - linked,
      };
    seen.add(row.target);
    linked += value;
  }
  return {
    error:
      linked > amount ? "Linked amounts exceed the received amount." : null,
    unused: amount - linked,
  };
}
