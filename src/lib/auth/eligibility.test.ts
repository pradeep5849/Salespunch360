import { describe, expect, it } from "vitest";
import { canAuthenticate } from "./eligibility";

describe("authentication eligibility", () => {
  it("allows active users and blocks deactivated users", () => {
    expect(canAuthenticate({ isActive: true })).toBe(true);
    expect(canAuthenticate({ isActive: false })).toBe(false);
  });
});
