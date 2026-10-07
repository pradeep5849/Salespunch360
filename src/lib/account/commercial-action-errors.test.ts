import { describe, expect, it } from "vitest";
import { z } from "zod";
import { commercialActionFailure } from "./commercial-action-errors";
import { AuthorizationError } from "@/lib/auth/authorization";
describe("safe commercial errors", () => {
  it("maps invalid input without exposing validation input", () => {
    const parsed = z
      .object({ branchId: z.string().uuid() })
      .safeParse({ branchId: "private" });
    if (parsed.success) throw new Error("Expected invalid input");
    expect(commercialActionFailure(parsed.error)).toMatchObject({
      ok: false,
      errorCode: "INVALID_INPUT",
    });
    expect(JSON.stringify(commercialActionFailure(parsed.error))).not.toContain(
      "private",
    );
  });
  it("maps authorization explicitly", () =>
    expect(commercialActionFailure(new AuthorizationError())).toMatchObject({
      ok: false,
      errorCode: "NOT_AUTHORIZED",
    }));
  it.each(["P2002", "P2003", "P2034"])(
    "maps database code %s without raw metadata",
    (code) => {
      const error = Object.assign(new Error("private constraint detail"), {
        code,
      });
      const result = commercialActionFailure(error);
      expect(result.errorCode).toBe(code);
      expect(JSON.stringify(result)).not.toContain(error.message);
    },
  );
  it("does not reflect unknown codes", () =>
    expect(
      commercialActionFailure(
        Object.assign(new Error("private"), { code: "private" }),
      ),
    ).toMatchObject({ ok: false, errorCode: "SAVE_FAILED" }));
});
