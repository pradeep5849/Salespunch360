import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  current: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: mocks.lock,
        pendingStorageDeletion: {
          findUnique: mocks.current,
          deleteMany: mocks.remove,
        },
      }),
    pendingStorageDeletion: {
      findMany: mocks.find,
      deleteMany: mocks.remove,
      updateMany: mocks.update,
    },
  },
}));
vi.mock("@/lib/storage", () => ({
  privateStorage: () => ({ delete: mocks.del }),
}));
import { retryPendingStorageDeletions } from "./deletion-queue";
describe("pending storage deletion retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current.mockImplementation(async () => row);
  });
  const row = {
    id: "q",
    objectKey: "companies/c/photo.webp",
    createdAt: new Date(),
  };
  it("clears a successful or already-absent object", async () => {
    mocks.find.mockResolvedValue([row]);
    mocks.del.mockResolvedValue(undefined);
    expect(await retryPendingStorageDeletions()).toMatchObject({
      deleted: 1,
      failed: 0,
    });
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "q" } });
  });
  it("retains failures and succeeds on retry", async () => {
    mocks.find.mockResolvedValue([row]);
    mocks.del
      .mockRejectedValueOnce(new Error("disk"))
      .mockResolvedValueOnce(undefined);
    expect(await retryPendingStorageDeletions()).toMatchObject({ failed: 1 });
    expect(mocks.update).toHaveBeenCalled();
    expect(await retryPendingStorageDeletions()).toMatchObject({ deleted: 1 });
    expect(mocks.remove).toHaveBeenCalled();
  });
  it("is idempotent with an empty queue", async () => {
    mocks.find.mockResolvedValue([]);
    expect(await retryPendingStorageDeletions()).toEqual({
      processed: 0,
      deleted: 0,
      failed: 0,
    });
  });
  it("does not delete an object when a restore cancelled its queued deletion", async () => {
    mocks.find.mockResolvedValue([row]);
    mocks.current.mockResolvedValue(null);
    expect(await retryPendingStorageDeletions()).toEqual({
      processed: 1,
      deleted: 0,
      failed: 0,
    });
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
