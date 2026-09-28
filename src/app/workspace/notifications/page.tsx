import Link from "next/link";
import {markAllSalesNotificationsReadAction,markSalesNotificationReadAction} from "@/app/actions/sales-notifications";
import {listSalesNotifications} from "@/lib/sales-notifications/service";
const when=(date:Date)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"}).format(date);
export default async function SalesNotificationsPage(){
 const {items,unreadCount}=await listSalesNotifications();
 return <main className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Sales</p><h1>Notifications</h1><p>Updates that need your attention, newest first.</p></div>{unreadCount>0&&<form action={markAllSalesNotificationsReadAction}><button className="button secondary">Mark all as read</button></form>}</div>
 <section className="card"><p aria-live="polite">{unreadCount} unread</p>{items.length===0?<div className="empty-state"><h2>You’re all caught up</h2><p>No Sales notifications yet.</p></div>:<div className="notification-list">{items.map(item=><article key={item.id} className={item.readAt?"notification-item":"notification-item unread"}><div><strong>{item.title}</strong><p>{item.body}</p><time dateTime={item.createdAt.toISOString()}>{when(item.createdAt)}</time></div><form action={markSalesNotificationReadAction}><input type="hidden" name="id" value={item.id}/>{item.navigationTarget?<Link className="button secondary" href={item.navigationTarget}>Open</Link>:null}{!item.readAt&&<button className="button secondary">Mark read</button>}</form></article>)}</div>}</section></main>;
}
