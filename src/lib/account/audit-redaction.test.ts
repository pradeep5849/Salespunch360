import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { redactAuditMetadata } from "./audit-redaction";
it("redacts nested secrets while preserving financial values and date serialization", () => {
  const value = redactAuditMetadata({
    amount: new Prisma.Decimal("12.34"),
    date: new Date("2026-11-05T00:00:00Z"),
    nested: [{ apiToken: "hidden", password: "hidden", name: "Retained" }],
  });
  expect(value).toEqual({
    amount: "12.34",
    date: "2026-11-05T00:00:00.000Z",
    nested: [
      { apiToken: "[REDACTED]", password: "[REDACTED]", name: "Retained" },
    ],
  });
});
