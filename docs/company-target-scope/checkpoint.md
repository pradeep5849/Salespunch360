# Company monthly targets and separate branch actuals

A161-F02 implements the owner's company-target decision. Monthly targets use one latest qualifying employee/metric target, without adding historical branch anchors. Saving paired targets no longer requires an ambiguous branch choice. Legacy branch IDs remain storage anchors; custom/quarterly targets retain their explicit original scope.

Web, Android and period-report/Excel output label target versus actual scope and show authorized branch actuals separately. Partial branch access never exposes other branch names or reports a company completion percentage from partial actuals. Existing Main Admin/Admin and Manager-team editing permissions remain; Sales remains read-only.

Validation: nine guarded local PostgreSQL scenarios passed (seven company-scope cases and two concurrent monthly-save cases). Focused target suite, TypeScript, lint and whitespace checks passed. Two native DTO cases cover nullable partial progress and separate branch counts; native CI/device acceptance remains pending. No production data change or deployment. This is slice seven since the last full regression; full regression remains due at the agreed batch boundary. Global single-location branch UI hiding is tracked separately by A134-F03.
