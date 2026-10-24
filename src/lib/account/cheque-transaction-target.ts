type Source = {
  settlementId?: string | null;
  settlement?: {
    type: string;
    allocations: Array<{ documentId: string; document: { type: string } }>;
    openingAllocations?: Array<unknown>;
  } | null;
};
/** A cheque paying several invoices or an advance has one payment source, not an arbitrary first invoice. */
export function chequeTransactionTarget(row: Source) {
  const allocations = row.settlement?.allocations ?? [];
  if (
    allocations.length === 1 &&
    !row.settlement?.type.endsWith("ADVANCE") &&
    !row.settlement?.openingAllocations?.length
  ) {
    const source = allocations[0],
      sale = source.document.type === "SALES_INVOICE";
    return {
      kind: "DOCUMENT" as const,
      id: source.documentId,
      type: source.document.type,
      href: sale
        ? `/workspace/account/sales/${source.documentId}`
        : `/workspace/account/transactions/${source.documentId}`,
      nativeHref: sale
        ? `/workspace/account/sales/${source.documentId}`
        : `/workspace/account/purchases/${source.documentId}`,
    };
  }
  if (
    row.settlementId &&
    row.settlement &&
    [
      "CUSTOMER_RECEIPT",
      "CUSTOMER_ADVANCE",
      "VENDOR_PAYMENT",
      "VENDOR_ADVANCE",
    ].includes(row.settlement.type)
  )
    return {
      kind: "SETTLEMENT" as const,
      id: row.settlementId,
      type: row.settlement.type,
      href: `/workspace/account/settlements/${row.settlementId}`,
      nativeHref: `/workspace/account/settlements/${row.settlementId}?type=${row.settlement.type}`,
    };
  return null;
}
