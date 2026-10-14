import { describe, expect, it, vi } from "vitest";
import { parseCustomFieldValue,saveCustomFieldValuesInTx } from "./custom-field-values";
const field = {
  fieldKey: "extra",
  isRequired: true,
  dataType: "TEXT" as const,
  options: null,
};
describe("A042-F06 custom-field semantics", () => {
  it("normalizes browser/native textarea line endings without changing content", () =>
    expect(
      parseCustomFieldValue(
        { ...field, dataType: "TEXTAREA" },
        "Line one\r\nLine two",
      ),
    ).toBe("Line one\nLine two"));
  it("enforces required values", () =>
    expect(() => parseCustomFieldValue(field, "")).toThrow(
      "CUSTOM_FIELDS_REQUIRED",
    ));
  it("supports fractional numbers and exact decimal strings", () => {
    expect(
      parseCustomFieldValue({ ...field, dataType: "NUMBER" }, "1.25"),
    ).toBe(1.25);
    expect(
      parseCustomFieldValue({ ...field, dataType: "DECIMAL" }, "1.250000"),
    ).toBe("1.250000");
  });
  it("rejects invalid dates, booleans and forged select options", () => {
    expect(() =>
      parseCustomFieldValue({ ...field, dataType: "DATE" }, "2026-02-30"),
    ).toThrow("INVALID_CUSTOM_FIELD");
    expect(() =>
      parseCustomFieldValue({ ...field, dataType: "BOOLEAN" }, "maybe"),
    ).toThrow("INVALID_CUSTOM_FIELD");
    expect(() =>
      parseCustomFieldValue(
        { ...field, dataType: "SELECT", options: ["Allowed"] },
        "Forged",
      ),
    ).toThrow("INVALID_CUSTOM_FIELD");
  });
  it("preserves false as a valid required boolean", () =>
    expect(
      parseCustomFieldValue({ ...field, dataType: "BOOLEAN" }, "false"),
    ).toBe(false));
});


describe("A089 editing stored custom fields",()=>{
 it("clears an explicitly blank optional value in the same company and entity",async()=>{
  const remove=vi.fn(),upsert=vi.fn();
  const tx={customFieldDefinition:{findMany:vi.fn().mockResolvedValue([{...field,id:"definition",isRequired:false}])},customFieldValue:{deleteMany:remove,upsert}};
  await saveCustomFieldValuesInTx(tx as unknown as import("@prisma/client").Prisma.TransactionClient,"company","CUSTOMER","customer",{extra:""},true);
  expect(remove).toHaveBeenCalledWith({where:{companyId:"company",definitionId:"definition",entityType:"CUSTOMER",entityId:"customer"}});expect(upsert).not.toHaveBeenCalled();
 });
 it("keeps omitted values and stores an explicit false instead of deleting it",async()=>{
  const remove=vi.fn(),upsert=vi.fn();
  const tx={customFieldDefinition:{findMany:vi.fn().mockResolvedValue([{...field,id:"definition",dataType:"BOOLEAN"}])},customFieldValue:{deleteMany:remove,upsert}};
  await saveCustomFieldValuesInTx(tx as unknown as import("@prisma/client").Prisma.TransactionClient,"company","CUSTOMER","customer",{},true);expect(upsert).not.toHaveBeenCalled();
  await saveCustomFieldValuesInTx(tx as unknown as import("@prisma/client").Prisma.TransactionClient,"company","CUSTOMER","customer",{extra:"false"},true);expect(upsert).toHaveBeenCalledWith(expect.objectContaining({update:{value:false}}));expect(remove).not.toHaveBeenCalled();
 });
});
