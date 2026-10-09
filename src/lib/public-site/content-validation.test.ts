import { it, expect } from "vitest";
import { boundedPublicText } from "./content-validation";
import { publicContentPage } from "./pagination";
it("rejects oversized content without returning silently truncated text", () => {
  expect(() => boundedPublicText("x".repeat(30001), 30000)).toThrow(
    "30000-character",
  );
  expect(
    boundedPublicText("  " + "x".repeat(30000) + "  ", 30000),
  ).toHaveLength(30000);
  expect(() => boundedPublicText("x".repeat(2001), 2000)).toThrow();
  expect(() => boundedPublicText("x".repeat(801), 800)).toThrow();
});
it.each(["-1", "0", "NaN", "Infinity", "1.5", "1000001"])(
  "bounds public page input %s",
  (v) => expect(publicContentPage(v)).toBe(1),
);
it("accepts bounded positive pages", () =>
  expect(publicContentPage("2")).toBe(2));
