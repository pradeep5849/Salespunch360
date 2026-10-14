/** Entity outputs that currently render saved custom-field values. */
export const CUSTOM_FIELD_PRINT_ENTITIES = [
  "CUSTOMER", "VENDOR", "QUOTATION", "SALES_INVOICE", "PURCHASE_BILL",
] as const;
export function supportsCustomFieldPrint(entity: string): boolean {
  return CUSTOM_FIELD_PRINT_ENTITIES.some(value => value === entity);
}
