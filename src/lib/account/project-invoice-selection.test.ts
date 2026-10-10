import { describe, expect, it } from "vitest";
import { projectInvoiceSelection } from "./project-invoice-selection";
const project = {
  id: "project",
  name: "Site",
  customerId: "customer",
  branchId: "branch",
  status: "ACTIVE",
};
const customer = { id: "customer", name: "Customer", branchId: "branch" };
describe("Project invoice entry context", () => {
  it("uses the Project branch and customer rather than the default company branch", () => {
    expect(
      projectInvoiceSelection(
        [project],
        [customer, { ...customer, id: "other" }],
        "project",
      ),
    ).toMatchObject({ branchId: "branch", partyId: "customer" });
  });
  it("rejects unavailable Projects, foreign-branch customers and inactive workflow states", () => {
    expect(projectInvoiceSelection([], [customer], "project")).toBeNull();
    expect(
      projectInvoiceSelection(
        [project],
        [{ ...customer, branchId: "other" }],
        "project",
      ),
    ).toBeNull();
    for (const status of ["COMPLETED", "CLOSED", "CANCELLED"])
      expect(
        projectInvoiceSelection(
          [{ ...project, status }],
          [customer],
          "project",
        ),
      ).toBeNull();
  });
  it("keeps held Projects selectable according to the existing workflow", () => {
    expect(
      projectInvoiceSelection(
        [{ ...project, status: "ON_HOLD" }],
        [customer],
        "project",
      ),
    ).not.toBeNull();
  });
});
