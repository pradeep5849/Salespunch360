import { expect, it } from "vitest";
import {
  CSV_ENCODING_COLUMN,
  CSV_ENCODING,
  decodeCsvRecord,
  encodeCsv,
  validateExportRequest,
} from "./tabular-transfer";
it("neutralizes formula and control prefixes without losing literal apostrophes", () => {
  for (const value of [
    "=1+1",
    "+cmd",
    "-2",
    "@SUM(A1)",
    "\t=1",
    "\r=1",
    "'literal",
  ]) {
    const csv = encodeCsv([{ name: value }], ["name"]);
    expect(csv).toContain(`"'${value}"`);
    expect(
      decodeCsvRecord({
        name: `'${value}`,
        [CSV_ENCODING_COLUMN]: CSV_ENCODING,
      }),
    ).toEqual({ name: value });
  }
  expect(decodeCsvRecord({ name: "'literal" })).toEqual({ name: "'literal" });
});
it("keeps a stable header for an empty export", () =>
  expect(encodeCsv([], ["name", "branch"])).toBe(
    `"name","branch","${CSV_ENCODING_COLUMN}"`,
  ));
it("validates both export parameters", () => {
  expect(() => validateExportRequest("items", "csv")).not.toThrow();
  expect(() => validateExportRequest("items", "exe")).toThrow(
    "UNSUPPORTED_EXPORT_FORMAT",
  );
  expect(() => validateExportRequest("private-keys", "csv")).toThrow(
    "UNSUPPORTED_EXPORT",
  );
});
