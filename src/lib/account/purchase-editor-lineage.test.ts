import { describe, expect, it } from "vitest";
import {
  applyAdjustmentSourceLine,
  newCommercialLine,
  type SourceLine,
} from "@/app/workspace/account/transactions/new/commercial-editor";

describe("purchase adjustment item identity", () => {
  const source: SourceLine = {
    id: "source-line",
    lineType: "MATERIAL",
    itemName: "Tracked material",
    productId: "product",
    serviceId: null,
    workPackageId: null,
    warehouseId: "source-warehouse",
    batchId: "source-batch",
    serialNumberId: null,
    quantity: "1",
    rate: "10",
    taxRate: "18",
    lineTotal: "11.8",
  };
  it("copies the original warehouse and tracking identity instead of stale editor selections", () => {
    const applied = applyAdjustmentSourceLine(
      {
        ...newCommercialLine(),
        warehouseId: "other",
        batchId: "other",
        serialNumberId: "other",
      },
      source,
    );
    expect(applied).toMatchObject({
      sourceCommercialLineId: "source-line",
      sourceId: "product",
      warehouseId: "source-warehouse",
      batchId: "source-batch",
      serialNumberId: "",
    });
  });
  it("clears tracking identity when the selected original line is untracked", () => {
    expect(
      applyAdjustmentSourceLine(
        { ...newCommercialLine(), batchId: "other", serialNumberId: "other" },
        { ...source, batchId: null, warehouseId: null },
      ),
    ).toMatchObject({ batchId: "", serialNumberId: "", warehouseId: "" });
  });
});
