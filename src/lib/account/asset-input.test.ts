import { describe, expect, it } from "vitest";
import { assetFormInput } from "./asset-input";
describe("A044-F04 explicit asset clears", () => {
  it("keeps omitted fields absent and retains populated values", () => {
    const form = new FormData();
    form.set("name", "Equipment");
    expect(assetFormInput(form, true)).toEqual({ name: "Equipment" });
  });
  it.each([
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
  ])("clears %s on edit", (key) => {
    const form = new FormData();
    form.set(key, "");
    expect(assetFormInput(form, true)).toEqual({ [key]: null });
    expect(assetFormInput(form)).toEqual({});
  });
  it("does not forward routing and submit-button fields", () => {
    const form = new FormData();
    form.set("id", "asset");
    form.set("saveMode", "new");
    form.set("requestKey", "request");
    expect(assetFormInput(form)).toEqual({ requestKey: "request" });
  });
});
