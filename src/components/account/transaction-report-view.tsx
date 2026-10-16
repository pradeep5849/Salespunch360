import Link from "next/link";
import {Money} from "./account-ui";
import {AccountDate} from "./display-preferences";
import {ReportTable} from "./report-table";
import type {ReportResult} from "@/lib/account/reports/service";
import styles from "./transaction-report-view.module.css";
export function TransactionReportView({data}:{data:ReportResult}){
 if(!data.rows.length)return <section className={styles.empty} aria-label="No report transactions"><svg aria-hidden="true" width="80" height="80" viewBox="0 0 80 80"><rect x="15" y="12" width="50" height="58" rx="5" fill="white" stroke="#88b7df" strokeWidth="3"/><path d="M25 29h30M25 40h30M25 51h18" stroke="#88b7df" strokeWidth="3"/></svg><h2>No transactions for this period</h2><p style={{color:"#334155"}}>Choose a different period or clear the filters.</p></section>;
 return <><div className={styles.table}><ReportTable data={data}/></div><div className={styles.cards}>{data.rows.map((row,index)=><article key={index} className={styles.card} aria-label={`${row[2]} ${row[1]}`}><div className={styles.heading}><h2>{data.rowLinks?.[index]?<Link href={data.rowLinks[index]}>{row[1]} ›</Link>:row[1]}</h2><span className={styles.type}>{String(row[2]).toLowerCase()}</span></div><p>{row[3]}</p><p className={styles.date}><AccountDate value={String(row[0])}/></p><dl className={styles.amounts}><div><dt>Amount</dt><dd><Money value={String(row[4])}/></dd></div><div><dt>Balance Due</dt><dd><Money value={String(row[5])}/></dd></div></dl></article>)}</div></>
}
