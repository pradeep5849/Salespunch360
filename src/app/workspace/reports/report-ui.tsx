import Link from "next/link";
import { REPORT_TIME_ZONE } from "@/lib/reports/config";
import { GoogleRouteMap } from "./google-route-map";

export const dateTime=(date:Date|null)=>date?new Intl.DateTimeFormat("en-IN",{timeZone:REPORT_TIME_ZONE,dateStyle:"medium",timeStyle:"short"}).format(date):"—";
export const duration=(ms:number|null)=>ms==null?"Open / pending":`${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`;
export const distance=(meters:number|null)=>meters==null?"—":meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(2)} km`;
export function ReportHeader({title,description}:{title:string;description:string}){return <><Link className="report-back" href="/workspace/reports">← Reports</Link><p className="eyebrow">Historical reporting</p><h1>{title}</h1><p className="muted">{description} Times use Asia/Kolkata.</p></>}
export function Filters({filters,employees,children}:{filters:{startText:string;endText:string;employeeId?:string;q?:string};employees:{id:string;name:string;role:string;isActive:boolean}[];children?:React.ReactNode}){return <form className="report-filters"><label>From<input type="date" name="start" defaultValue={filters.startText}/></label><label>To<input type="date" name="end" defaultValue={filters.endText}/></label>{employees.length>1&&<label>Employee<select name="employeeId" defaultValue={filters.employeeId||""}><option value="">All authorized</option>{employees.map(e=><option value={e.id} key={e.id}>{e.name} · {e.role}{e.isActive?"":" · inactive"}</option>)}</select></label>}{children}<button>Apply filters</button></form>}
export function Summary({items}:{items:{label:string;value:string|number}[]}){return <section className="report-summary">{items.map(i=><article key={i.label}><strong>{i.value}</strong><span>{i.label}</span></article>)}</section>}
export function Pagination({page,totalPages}:{page:number;totalPages:number}){return <nav className="pagination" aria-label="Report pages"><span>Page {page} of {totalPages}</span>{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}{page<totalPages&&<Link href={`?page=${page+1}`}>Next</Link>}</nav>}
export function ErrorState({error}:{error:unknown}){return <main className="reports-content"><ReportHeader title="Report filters need attention" description={error instanceof Error?error.message:"Unable to load this report."}/><Link href="?">Reset filters</Link></main>}

type MapPoint={latitude:number;longitude:number};
export function RouteMap({points,overlays}:{points:MapPoint[];overlays:{id:string;checkInLatitude:number;checkInLongitude:number;customer:{name:string}}[]}){
 return <GoogleRouteMap points={points} markers={overlays.map(o=>({latitude:o.checkInLatitude,longitude:o.checkInLongitude,label:`Check-in: ${o.customer.name}`}))}/>;
}
