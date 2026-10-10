import { expect, it } from "vitest";
import { expenseFormInput } from "./expense-input";
it("parses line JSON and checkbox booleans without forwarding UI controls", () => {
  const f = new FormData();
  f.set("billedItems", '[{"name":"Fuel","quantity":"2","rate":"10"}]');
  f.set("roundOffEnabled", "on");
  f.set("saveMode", "new");
  f.set("id", "not-input");
  expect(expenseFormInput(f)).toEqual({
    billedItems: [{ name: "Fuel", quantity: "2", rate: "10" }],
    roundOffEnabled: true,
  });
});
it("does not turn a false round-off value into true", () => {
  const f = new FormData();
  f.set("roundOffEnabled", "false");
  expect(expenseFormInput(f).roundOffEnabled).toBe(false);
});
