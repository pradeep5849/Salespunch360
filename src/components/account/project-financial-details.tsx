type Row = Record<string, string | null>;
export function ProjectFinancialDetails({
  details,
}: {
  details: {
    purchases: Row[];
    expenses: Row[];
    expenseCategories: Row[];
    materialMovements: Row[];
    payments: Row[];
    invoices: Row[];
  };
}) {
  const sections = [
    {
      title: "Labour and expense category totals",
      rows: details.expenseCategories,
      columns: ["category", "amount", "cost"],
    },
    {
      title: "Purchases",
      rows: details.purchases,
      columns: [
        "number",
        "date",
        "status",
        "item",
        "quantity",
        "taxableAmount",
        "taxAmount",
        "totalAmount",
      ],
    },
    {
      title: "Labour and other expenses",
      rows: details.expenses,
      columns: [
        "number",
        "date",
        "category",
        "reference",
        "notes",
        "amount",
        "cost",
      ],
    },
    {
      title: "Material movement and cost adjustments",
      rows: details.materialMovements,
      columns: [
        "date",
        "type",
        "item",
        "quantity",
        "cost",
        "sourceProjectId",
        "destinationProjectId",
        "reversalOfId",
        "reason",
      ],
    },
    {
      title: "Advances, installments and payments",
      rows: details.payments,
      columns: [
        "number",
        "date",
        "reference",
        "paymentMode",
        "type",
        "status",
        "amount",
        "remainingAmount",
      ],
    },
    {
      title: "Invoices and customer balance",
      rows: details.invoices,
      columns: [
        "number",
        "date",
        "type",
        "status",
        "revenue",
        "tax",
        "total",
        "outstanding",
      ],
    },
  ];
  return (
    <section aria-label="Project financial supporting records">
      <p>
        Posted purchases and expenses contribute to actual cost. Drafts and
        orders are shown for reference. Material consumption is not charged a
        second time; transfers and returns adjust cost. Advances and
        installments are payments, not extra revenue.
      </p>
      {sections.map(({ title, rows, columns }) => (
        <section key={title}>
          <h2>{title}</h2>
          {rows.length ? (
            <div className="table-wrap">
              <table>
                <caption>
                  {title} — {rows.length} entries
                </caption>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th scope="col" key={column}>
                        {column.replace(/([A-Z])/g, " $1")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      {columns.map((column) => (
                        <td key={column}>{row[column] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No entries recorded.</p>
          )}
        </section>
      ))}
    </section>
  );
}
