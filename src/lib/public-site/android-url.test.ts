import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validatedGooglePlayUrl, googlePlayDestination } from "./android-url";

describe("Google Play destination validation", () => {
  it("accepts an official HTTPS listing", () =>
    expect(
      validatedGooglePlayUrl(
        "https://play.google.com/store/apps/details?id=com.example.app",
      ),
    ).toBe("https://play.google.com/store/apps/details?id=com.example.app"));
  it.each([
    undefined,
    "",
    "malformed value",
    "http://play.google.com/store/apps/details?id=com.example.app",
    "https://example.com/store/apps/details?id=com.example.app",
    "https://play.google.com.example.com/app",
  ])("rejects unsafe or missing configuration: %s", (value) =>
    expect(validatedGooglePlayUrl(value)).toBeUndefined(),
  );
  it("invokes the framework redirect only after validation", () => {
    const page = readFileSync("src/app/(marketing)/android/page.tsx", "utf8");
    expect(page).toContain("const playUrl = googlePlayDestination");
    expect(page).toContain("if (playUrl) redirect(playUrl)");
    expect(page).not.toMatch(/try[\s\S]*?redirect/);
  });
});

it.each([
  "https://play.google.com/",
  "https://play.google.com/store",
  "https://play.google.com/store/apps/details",
  "https://play.google.com/store/apps/details?id=",
  "https://play.google.com/store/apps/details?id=invalid",
  "https://play.google.com/store/apps/details?id=com.example&id=com.other",
  "https://user:password@play.google.com/store/apps/details?id=com.example",
])("rejects non-listing destination %s", (url) =>
  expect(validatedGooglePlayUrl(url)).toBeUndefined(),
);
it("uses the same validated configuration precedence for all download entry points", () => {
  expect(
    googlePlayDestination(
      "https://play.google.com/store/apps/details?id=com.configured",
      "https://play.google.com/store/apps/details?id=com.environment",
    ),
  ).toContain("com.configured");
  expect(
    googlePlayDestination(
      "https://example.test",
      "https://play.google.com/store/apps/details?id=com.environment",
    ),
  ).toContain("com.environment");
  expect(googlePlayDestination(null, undefined)).toBeUndefined();
  expect(
    validatedGooglePlayUrl(
      "https://play.google.com/store/apps/details?id=com.example&hl=en_IN",
    ),
  ).toContain("hl=en_IN");
});
