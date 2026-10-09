import { expect, it } from "vitest";
import { assetOpeningValue } from "./asset-opening-value";
it.each([
  ["2", "50", "100.00"],
  ["1.25", "10.12", "12.65"],
  ["0.0001", "50", "0.01"],
  ["99999999999999", "100", "9999999999999900.00"],
])("uses exact decimal opening valuation for %s × %s", (q, p, total) =>
  expect(assetOpeningValue(q, p)).toBe(total),
);
it.each([
  ["", "50"],
  ["1", ""],
  ["-1", "10"],
  ["1.12345", "1"],
  ["1", "1.123"],
])("rejects invalid preview inputs %s/%s", (q, p) =>
  expect(assetOpeningValue(q, p)).toBeUndefined(),
);
