import Link from "next/link";
import {Money} from "./account-ui";
import {AccountDate} from "./display-preferences";
import {ReportTable} from "./report-table";
import type {ReportResult} from "@/lib/account/reports/service";
import styles from "./profit-report-view.module.css";
export function ProfitReportView({data,billWise}:{data:ReportResult;billWise:boolean}) {
 if(!data.rows.length)return <p>No profit records match the selected filters.</p>;
 return <><div className={styles.table}><ReportTable data={data}/></div><div className={styles.cards}>{data.rows.map((row,index)=><article key={index}>
  <header><h2>{data.rowLinks?.[index]?<Link href={data.rowLinks[index]}> {row[0]} ›</Link>:row[0]}</h2>{billWise&&<span>{String(row[8]).replaceAll("_"," ").toLowerCase()}</span>}</header>
  {billWise&&<><p>{row[7]}</p><p><AccountDate value={String(row[6])}/></p></>}
  <dl className={styles.amounts}><div><dt>Revenue (excluding tax)</dt><dd><Money value={String(row[2])}/></dd></div><div className={String(row[4]).startsWith("-")?styles.loss:styles.profit}><dt>Profit / Loss</dt><dd><Money value={String(row[4])}/></dd></div></dl>
  <details><summary>Calculation details</summary><dl className={styles.details}><div><dt>Quantity</dt><dd>{row[1]}</dd></div><div><dt>Inventory cost</dt><dd><Money value={String(row[3])}/></dd></div><div><dt>Margin</dt><dd>{row[5]}%</dd></div></dl></details>
 </article>)}</div></>;
}
