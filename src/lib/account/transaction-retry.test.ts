import { describe, expect, it, vi } from "vitest";
import { retrySerializable } from "./transaction-retry";
describe("serialization retry policy", () => {
  it.each([
    { code: "P2034" },
    { code: "P2010", meta: { code: "40001" } },
    { code: "P2010", meta: { code: "40P01" } },
  ])("retries only serialization/deadlock aborts %j", async (metadata) => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("retry"), metadata))
      .mockResolvedValue("committed");
    expect(await retrySerializable(operation)).toBe("committed");
    expect(operation).toHaveBeenCalledTimes(2);
  });
  it("does not retry business or other database errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("invalid"), { code: "P2002" }),
      );
    await expect(retrySerializable(operation)).rejects.toThrow("invalid");
    expect(operation).toHaveBeenCalledOnce();
  });
  it("bounds retries", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("busy"), { code: "P2034" }));
    await expect(retrySerializable(operation)).rejects.toThrow("busy");
    expect(operation).toHaveBeenCalledTimes(3);
  });
  it("retries an explicitly authorized request identity collision", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("concurrent replay"), {
          code: "P2002",
          meta: { target: ["companyId", "idempotencyKey"] },
        }),
      )
      .mockResolvedValue({ id: "original" });
    expect(
      await retrySerializable(operation, 3, ["companyId", "idempotencyKey"]),
    ).toEqual({ id: "original" });
    expect(operation).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["companyId", "projectNumber"],
    ["idempotencyKey"],
    ["companyId", "idempotencyKey", "other"],
  ])("does not retry another unique target %j", async (...target) => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("unique business constraint"), {
          code: "P2002",
          meta: { target },
        }),
      );
    await expect(
      retrySerializable(operation, 3, ["companyId", "idempotencyKey"]),
    ).rejects.toThrow("unique business constraint");
    expect(operation).toHaveBeenCalledOnce();
  });
  it("does not infer replay permission from an unstructured unique error", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("unknown constraint"), {
          code: "P2002",
          meta: { target: "companyId_idempotencyKey" },
        }),
      );
    await expect(
      retrySerializable(operation, 3, ["companyId", "idempotencyKey"]),
    ).rejects.toThrow("unknown constraint");
    expect(operation).toHaveBeenCalledOnce();
  });
  it("bounds replay collision retries and returns the final error", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("still busy"), {
          code: "P2002",
          meta: { target: ["companyId", "idempotencyKey"] },
        }),
      );
    await expect(
      retrySerializable(operation, 3, ["companyId", "idempotencyKey"]),
    ).rejects.toThrow("still busy");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
