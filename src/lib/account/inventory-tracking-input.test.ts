import {describe,expect,it} from "vitest";
import {inventoryBatchInput,inventorySerialInput} from "./inventory-tracking-input";
const productId="00000000-0000-4000-8000-000000000001";
describe("inventory batch and serial calendar dates",()=>{
 it("retains valid manufactured/expiry dates and permits absent optional dates",()=>{
  const batch=inventoryBatchInput.parse({productId,batchNumber:"Batch",manufacturedDate:"2024-02-29",expiryDate:"2026-10-13"});
  expect(batch.manufacturedDate?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  expect(batch.expiryDate?.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  expect(inventorySerialInput.parse({productId,serialNumber:"S"}).expiryDate).toBeUndefined();
 });
 it.each(["2026-02-30","2025-02-29","2026-13-01","not-a-date","2026-10-13T00:00:00Z"])("rejects invalid or timestamp date input %s",date=>{
  expect(inventoryBatchInput.safeParse({productId,batchNumber:"B",manufacturedDate:date}).success).toBe(false);
  expect(inventorySerialInput.safeParse({productId,serialNumber:"S",expiryDate:date}).success).toBe(false);
 });
 it("preserves existing Date callers and rejects invalid Date objects",()=>{
  expect(inventorySerialInput.parse({productId,serialNumber:"S",expiryDate:new Date("2026-10-13")}).expiryDate?.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  expect(inventorySerialInput.safeParse({productId,serialNumber:"S",expiryDate:new Date("invalid")}).success).toBe(false);
 });
});
