import { expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
}));
import { parseTaxCatalogEntry } from "./tax-catalog";
const form = (x: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(x).forEach(([k, v]) => fd.set(k, v));
  return fd;
};
it("rejects missing and empty rates instead of treating them as zero", () => {
  expect(() =>
    parseTaxCatalogEntry("RATE", form({ name: "Missing" })),
  ).toThrow();
  expect(() =>
    parseTaxCatalogEntry("RATE", form({ name: "Empty", rate: "" })),
  ).toThrow();
  expect(
    parseTaxCatalogEntry("RATE", form({ name: "Exempt", rate: "0" })),
  ).toEqual({ name: "Exempt", rate: 0 });
});
it("validates component totals and precision", () => {
  expect(() =>
    parseTaxCatalogEntry(
      "GROUP",
      form({ name: "Bad", rate: "18", cgst: "9", sgst: "8" }),
    ),
  ).toThrow("TAX_GROUP_SPLIT_MUST_MATCH_RATE");
  expect(() =>
    parseTaxCatalogEntry("RATE", form({ name: "Bad", rate: "0.1234" })),
  ).toThrow();
  expect(
    parseTaxCatalogEntry(
      "GROUP",
      form({ name: "GST18", rate: "18", cgst: "9", sgst: "9" }),
    ),
  ).toEqual({ name: "GST18", rate: 18, cgst: 9, sgst: 9 });
});
