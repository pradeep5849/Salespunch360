import { Money } from "./account-ui";
export function ReportSummary({
  items,
}: {
  items: Array<{ label: string; value: string; money: boolean }>;
}) {
  return (
    <section
      aria-label="Report summary"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
        gap: 12,
        marginBlock: 16,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="account-panel">
          <p>{item.label}</p>
          <strong>
            {item.money ? <Money value={item.value} /> : item.value}
          </strong>
        </div>
      ))}
    </section>
  );
}
