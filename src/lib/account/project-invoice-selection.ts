export type InvoiceProjectOption = {
  id: string;
  name: string;
  customerId: string;
  branchId: string;
  status: string;
};
export type InvoiceCustomerOption = {
  id: string;
  name: string;
  branchId?: string;
};

/** Resolve only the server-provided Project and its own customer/branch. */
export function projectInvoiceSelection(
  projects: readonly InvoiceProjectOption[],
  customers: readonly InvoiceCustomerOption[],
  projectId: string,
) {
  const project = projects.find(
    (row) =>
      row.id === projectId &&
      !["COMPLETED", "CLOSED", "CANCELLED"].includes(row.status),
  );
  const customer =
    project &&
    customers.find(
      (row) =>
        row.id === project.customerId && row.branchId === project.branchId,
    );
  return project && customer
    ? { project, customer, branchId: project.branchId, partyId: customer.id }
    : null;
}
