import { accountLabel } from "./account-labels";
import { describe, it, expect } from "vitest";
import {
  resolveDisplayPreferences,
  formatMoney,
  formatCalendarDate,
} from "./display-preferences";
describe("General display consumers", () => {
  it("changes supported labels while preserving business names and identifiers", () => {
    expect(accountLabel("General", "hi")).toBe("सामान्य");
    expect(accountLabel("Business Currency", "hi")).toBe("व्यवसाय की मुद्रा");
    expect(accountLabel("General", "en")).toBe("General");
    expect(accountLabel("Acme Customer S-1246", "hi")).toBe(
      "Acme Customer S-1246",
    );
  });
  it.each([0, 1, 2, 3, 4])(
    "applies saved monetary precision %i",
    (decimals) => {
      const preferences = resolveDisplayPreferences({
        baseCurrency: "USD",
        displayDecimalPlaces: decimals,
      });
      const amount = formatMoney("12.34567", preferences);
      expect(amount).toBe(
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(12.34567),
      );
    },
  );
  it.each(["INR", "USD", "EUR", "GBP", "AED"])(
    "uses selected business currency %s",
    (baseCurrency) =>
      expect(
        formatMoney("100", resolveDisplayPreferences({ baseCurrency })),
      ).toBe(
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: baseCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(100),
      ),
  );
  it.each([
    ["DD/MM/YYYY", "11/10/2026"],
    ["MM/DD/YYYY", "10/11/2026"],
    ["YYYY-MM-DD", "2026-10-11"],
  ])("keeps calendar date stable for %s", (dateFormat, expected) =>
    expect(
      formatCalendarDate(
        "2026-10-11T00:00:00.000Z",
        resolveDisplayPreferences({ dateFormat }),
      ),
    ).toBe(expected),
  );
  it("defaults invalid stored preferences without crashing money consumers", () => {
    const preferences = resolveDisplayPreferences({
      baseCurrency: "invalid",
      displayDecimalPlaces: NaN,
    });
    expect(preferences.baseCurrency).toBe("INR");
    expect(preferences.displayDecimalPlaces).toBe(2);
    expect(formatMoney("5", preferences)).toContain("5.00");
  });
  it("preserves cents above the safe integer range", () => {
    expect(formatMoney("9007199254740991.01")).toBe(
      "₹9,00,71,99,25,47,40,991.01",
    );
    expect(formatMoney("-9007199254740991.01")).toBe(
      "-₹9,00,71,99,25,47,40,991.01",
    );
  });
  it("rounds signed small values and carries exactly at configured precision", () => {
    expect(formatMoney("-0.005")).toBe("-₹0.01");
    expect(formatMoney("9999999999999999.995")).toBe(
      "₹10,00,00,00,00,00,00,000.00",
    );
    expect(formatMoney("-0.004")).toBe("-₹0.00");
  });
  it("formats decimal scientific notation without losing fractional digits", () => {
    expect(formatMoney("9.00719925474099101e15")).toBe(
      formatMoney("9007199254740991.01"),
    );
    expect(formatMoney("5e-3")).toBe("₹0.01");
  });
});
