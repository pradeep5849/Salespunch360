"use client";

import { SaleInvoiceVyapar, type SaleInvoiceOptions } from "../../../transactions/new/sale-invoice-vyapar";
import type { SaleEditInitial } from "@/lib/account/sale-edit-initial";

export function SaleEditForm({ initial, options }: { initial: SaleEditInitial; options: SaleInvoiceOptions }) {
  return <SaleInvoiceVyapar options={options} initialSale={initial} />;
}
