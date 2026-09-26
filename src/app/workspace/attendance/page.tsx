import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { getAttendanceOverview, getCurrentAttendance } from "@/lib/attendance/service";
import { operationalBranchContext } from "@/lib/branches/operational-scope";
import { db } from "@/lib/db";
import { indiaDateText, parseIndiaBusinessDate } from "@/lib/follow-up-tasks/date";
import { AttendanceControls } from "./attendance-controls";

export const metadata: Metadata = { title: "Attendance" };
const istTime=(value:Date)=>`${value.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"})} IST`;

export default async function AttendancePage() {
  const user = await requirePermission("SALES_ATTENDANCE");
  const isEmployee = user.salesRole === "SALES" || (user.salesRole === "MANAGER" && user.managerType !== "MANAGER_ONLY");
  const canViewOverview =
    user.salesRole === "PRIMARY_ADMIN" ||
    user.salesRole === "ADMIN" ||
    user.salesRole === "MANAGER";
  const current = isEmployee ? await getCurrentAttendance() : null;
  const overview = canViewOverview ? await getAttendanceOverview() : [];
  const branchContext=canViewOverview&&overview.length&&user.companyId?await operationalBranchContext({id:user.id,companyId:user.companyId}):null;
  const today=parseIndiaBusinessDate(indiaDateText()),tomorrow=new Date(today.getTime()+86400000);
  const endedAttendances=branchContext&&user.companyId?await db.attendance.findMany({where:{companyId:user.companyId,branchId:branchContext.branchId,userId:{in:overview.map(employee=>employee.id)},endedAt:{gte:today,lt:tomorrow}},orderBy:{endedAt:"desc"},select:{userId:true,endedAt:true}}):[];
  const latestEndByUser=new Map<string,Date>();
  endedAttendances.forEach(attendance=>{if(attendance.endedAt&&!latestEndByUser.has(attendance.userId))latestEndByUser.set(attendance.userId,attendance.endedAt);});
  return <main className="attendance-shell"><section className="attendance-content"><WorkspacePageHeader title="Attendance" backHref="/workspace"/>{current && <AttendanceControls initialOpen={Boolean(current.attendance)} startedAt={current.attendance?.startedAt.toISOString()} gpsEnabled={current.settings.gpsTrackingEnabled || current.settings.attendanceGeofenceEnabled} attendanceEnabled={current.settings.attendanceEnabled} pointCount={current.attendance?._count.locationPoints ?? 0} />}{overview.length > 0 && <section className="attendance-overview"><div><h2>Team attendance</h2><p className="muted">{user.salesRole==="MANAGER"?"Current attendance status of your assigned sales team.":"Current attendance state for your company."}</p></div><div className="attendance-list">{overview.map((employee) => { const open = employee.attendances[0]; const endedAt=latestEndByUser.get(employee.id); return <article key={employee.id}><div className="avatar">{employee.name.charAt(0)}</div><div><strong>{employee.name}</strong><span>{employee.salesRole === "MANAGER" ? "Manager" : "Sales"} · {employee.isActive ? "Active employee" : "Inactive employee"}</span></div><div className={open ? "working-pill" : "off-pill"}>{open ? `Working since ${istTime(open.startedAt)} · ${open._count.locationPoints} points` : endedAt ? `Attendance ended at ${istTime(endedAt)}` : "Not working today"}</div></article>; })}</div></section>}</section></main>;
}
