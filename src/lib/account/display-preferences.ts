export type DisplayPreferences = {
  appLanguage: "en" | "hi";
  baseCurrency: string;
  displayDecimalPlaces: number;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
};
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  appLanguage: "en",
  baseCurrency: "INR",
  displayDecimalPlaces: 2,
  dateFormat: "DD/MM/YYYY",
};
export function resolveDisplayPreferences(
  value:
    | {
        appLanguage?: string;
        baseCurrency?: string;
        displayDecimalPlaces?: number;
        dateFormat?: string;
      }
    | null
    | undefined,
): DisplayPreferences {
  return {
    appLanguage: value?.appLanguage === "hi" ? "hi" : "en",
    baseCurrency: ["INR", "USD", "EUR", "GBP", "AED"].includes(
      value?.baseCurrency ?? "",
    )
      ? value!.baseCurrency!
      : "INR",
    displayDecimalPlaces: Number.isInteger(value?.displayDecimalPlaces)
      ? Math.min(4, Math.max(0, value!.displayDecimalPlaces!))
      : 2,
    dateFormat:
      value?.dateFormat === "MM/DD/YYYY"
        ? "MM/DD/YYYY"
        : value?.dateFormat === "YYYY-MM-DD"
          ? "YYYY-MM-DD"
          : "DD/MM/YYYY",
  };
}
export function formatMoney(
  value: { toString(): string } | number | string,
  preferences: DisplayPreferences = DEFAULT_DISPLAY_PREFERENCES,
) {
  const raw = value.toString();
  const locale = preferences.appLanguage === "hi" ? "hi-IN" : "en-IN";
  const decimals = Number.isFinite(preferences.displayDecimalPlaces)
    ? Math.min(4, Math.max(0, Math.trunc(preferences.displayDecimalPlaces)))
    : 2;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: preferences.baseCurrency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw.trim());
  if (!match)
    return Number.isFinite(Number(raw)) ? formatter.format(Number(raw)) : raw;
  const [, sign, integer, fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000) return raw;
  const digits = integer + fraction;
  const point = integer.length + exponent;
  const whole = point <= 0 ? "0" : digits.slice(0, point).padEnd(point, "0");
  const tail = point <= 0 ? "0".repeat(-point) + digits : digits.slice(point);
  const padded = tail.padEnd(decimals + 1, "0");
  let scaled = BigInt(whole + padded.slice(0, decimals));
  if (padded[decimals] >= "5") scaled += BigInt(1);
  const rounded = scaled.toString().padStart(decimals + 1, "0");
  const displayWhole = decimals ? rounded.slice(0, -decimals) : rounded;
  const displayFraction = decimals ? rounded.slice(-decimals) : "";
  const grouped = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(BigInt(displayWhole));
  // Format a sign/currency template; substitute exact decimal digits without a Number conversion.
  let inserted = false;
  return formatter
    .formatToParts(sign === "-" ? -BigInt(1) : BigInt(1))
    .map((part) => {
      if (part.type === "integer") {
        if (inserted) return "";
        inserted = true;
        return grouped;
      }
      if (part.type === "group") return "";
      if (part.type === "fraction") return displayFraction;
      return part.value;
    })
    .join("");
}
export function formatCalendarDate(
  value: Date | string,
  preferences: DisplayPreferences = DEFAULT_DISPLAY_PREFERENCES,
) {
  const date =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, year, month, day] = match;
  return preferences.dateFormat === "YYYY-MM-DD"
    ? date
    : preferences.dateFormat === "MM/DD/YYYY"
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
}
