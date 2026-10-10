/** Omission preserves a field; an explicit blank edit clears nullable metadata. */
const nullableFields = new Set([
  "category",
  "description",
  "serialNumber",
  "registrationNumber",
  "makeModel",
  "location",
  "manufactureYear",
  "usefulLifeMonths",
  "depreciationStartDate",
  "vendorId",
  "purchaseDocumentId",
  "purchaseDocumentLineId",
  "assetLedgerId",
  "accumulatedDepreciationLedgerId",
  "depreciationExpenseLedgerId",
  "hsnCode",
  "openingQuantity",
  "unitPrice",
  "effectiveDate",
]);
export function assetFormInput(form: FormData, edit = false) {
  return Object.fromEntries(
    [...form.entries()]
      .filter(
        ([key, value]) =>
          !["id", "saveMode"].includes(key) &&
          (value !== "" || (edit && nullableFields.has(key))),
      )
      .map(([key, value]) => [
        key,
        value === "" && nullableFields.has(key) ? null : value,
      ]),
  );
}
