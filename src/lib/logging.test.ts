import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "./logging";
afterEach(() => vi.restoreAllMocks());
describe("structured logging", () => {
  it("drops arbitrary request data at runtime", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent(
      "error",
      Object.assign(
        { category: "HEALTH_CHECK", correlationId: "reference" },
        {
          password: "secret",
          authorization: "Bearer secret",
          latitude: 12,
          body: { email: "private@example.com" },
        },
      ),
    );
    const entry = JSON.parse(output.mock.calls[0][0]);
    expect(entry.category).toBe("HEALTH_CHECK");
    expect(entry.correlationId).toBe("reference");
    expect(entry).not.toHaveProperty("password");
    expect(entry).not.toHaveProperty("authorization");
    expect(entry).not.toHaveProperty("latitude");
    expect(entry).not.toHaveProperty("body");
  });
  it.each(["info", "warn"] as const)(
    "routes %s records and retains duration",
    (level) => {
      const output = vi.spyOn(console, level).mockImplementation(() => {});
      logEvent(level, { category: "HEALTH_CHECK", durationMs: 5 });
      expect(JSON.parse(output.mock.calls[0][0]).durationMs).toBe(5);
    },
  );
});
