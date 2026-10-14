import { expect, it } from "vitest";
import { missingRuntimeColumns } from "./check-runtime-schema.mjs";
const models = [
  {
    name: "ExpenseTransaction",
    dbName: "expense_transactions",
    fields: [
      { name: "id", kind: "scalar" },
      { name: "creationRequestKey", kind: "scalar" },
      { name: "category", kind: "object" },
      { name: "status", kind: "enum" },
    ],
  },
];
it("detects the precise A052 production missing column without treating relations as database columns", () => {
  expect(
    missingRuntimeColumns(models, [
      { table_name: "expense_transactions", column_name: "id" },
      { table_name: "expense_transactions", column_name: "status" },
    ]),
  ).toEqual(["expense_transactions.creationRequestKey"]);
});
it("passes migrated columns and honours mapped field names", () => {
  expect(
    missingRuntimeColumns(
      [
        {
          name: "Mapped",
          dbName: "mapped",
          fields: [
            { name: "requestKey", dbName: "request_key", kind: "scalar" },
          ],
        },
      ],
      [{ table_name: "mapped", column_name: "request_key" }],
    ),
  ).toEqual([]);
});
it("flags a wrong or empty database target rather than reporting it healthy", () => {
  expect(missingRuntimeColumns(models, [])).toEqual([
    "expense_transactions.creationRequestKey",
    "expense_transactions.id",
    "expense_transactions.status",
  ]);
});
