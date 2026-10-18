import type {ReportResult} from "@/lib/account/reports/service";
import styles from "./stock-detail-view.module.css";

export function StockDetailView({data}: {data: ReportResult}) {
  if (!data.rows.length) return <p>No stock items match the selected filters.</p>;
  return <div className={styles.cards}>{data.rows.map((row, index) => <article key={index}>
    <header><h2>{row[0]}</h2><span>{row[1]}</span></header>
    <p>Closing Quantity: <strong>{row[6]} {row[2]}</strong></p>
    <dl>{[["Beginning Qty", row[3]], ["Quantity In", row[4]], ["Quantity Out", row[5]]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value} {row[2]}</dd></div>)}</dl>
  </article>)}</div>;
}
