import { describe, it, expect } from "vitest";
import { nextRecurringDueDate } from "./recurrence";
const date = (value: string) => new Date(value + "T00:00:00Z");
describe("A053 calendar recurrence", () => {
  it("restores January 31 after February instead of drifting to the 28th", () => {
    const anchor = date("2026-01-31"),
      feb = nextRecurringDueDate(anchor, "MONTHLY", anchor);
    expect(feb.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(
      nextRecurringDueDate(feb, "MONTHLY", anchor).toISOString().slice(0, 10),
    ).toBe("2026-03-31");
  });
  it("retains February 29 through four yearly occurrences", () => {
    const anchor = date("2024-02-29");
    let due = anchor;
    for (let year = 2025; year <= 2028; year++) {
      due = nextRecurringDueDate(due, "YEARLY", anchor);
      expect(due.toISOString().slice(0, 10)).toBe(
        `${year}-02-${year === 2028 ? "29" : "28"}`,
      );
    }
  });
  it("clamps quarterly month ends while keeping its anchor", () => {
    const anchor = date("2026-01-31"),
      april = nextRecurringDueDate(anchor, "QUARTERLY", anchor);
    expect(april.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(
      nextRecurringDueDate(april, "QUARTERLY", anchor)
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-07-31");
  });
  it("weekly recurrence crosses month/year boundaries by seven days", () =>
    expect(
      nextRecurringDueDate(date("2026-12-28"), "WEEKLY")
        .toISOString()
        .slice(0, 10),
    ).toBe("2027-01-04"));
});
