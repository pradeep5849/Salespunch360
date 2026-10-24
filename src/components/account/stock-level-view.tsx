import type {ReportResult} from "@/lib/account/reports/service";
import {Money} from "./account-ui";
import styles from "./stock-detail-view.module.css";
export function StockLevelView({data}:{data:ReportResult}) {
 if(!data.rows.length)return <p>No stock items match the selected filters.</p>;
 return <div className={styles.cards}>{data.rows.map((row,index)=><article key={index}>
  <header><h2>{row[0]}</h2><span>{row[1]}</span></header>
  <dl className={styles.levelAmounts}><div><dt>Stock Quantity</dt><dd>{row[3]} {row[2]}</dd></div><div><dt>Stock Value</dt><dd><Money value={String(row[4])}/></dd></div></dl>
 </article>)}</div>;
}
