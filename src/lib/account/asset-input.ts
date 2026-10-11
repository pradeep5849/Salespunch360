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
  const customFields=Object.fromEntries([...form.entries()].filter(([key])=>key.startsWith("custom_")).map(([key,value])=>[key.slice(7),String(value)]));
  return {...Object.fromEntries(
    [...form.entries()]
      .filter(
        ([key, value]) =>
          !key.startsWith("custom_") && !["id", "saveMode"].includes(key) &&
          (value !== "" || (edit && nullableFields.has(key))),
      )
      .map(([key, value]) => [
        key,
        value === "" && nullableFields.has(key) ? null : value,
      ]),
  ),...(Object.keys(customFields).length?{customFields}:{})};
}
