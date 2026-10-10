import { it, expect } from "vitest";
import { validInquiryTelephone } from "./telephone";
it.each([
  "+91 96112 78818",
  "(212) 555-0199",
  "020 7946 0958",
  "+1-212-555-0199",
])("accepts supported telephone %s", (v) =>
  expect(validInquiryTelephone(v)).toBe(true),
);
it.each([
  "abcdefg",
  "call 9611278818",
  "+12",
  "+1234567890123456",
  "91+9611278818",
  "9611278818@example.test",
])("rejects malformed telephone %s", (v) =>
  expect(validInquiryTelephone(v)).toBe(false),
);
