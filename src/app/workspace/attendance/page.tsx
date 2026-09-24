import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { getAttendanceOverview, getCurrentAttendance } from "@/lib/attendance/service";
import { AttendanceControls } from "./attendance-controls";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const user = await requirePermission("SALES_ATTENDANCE");
  const isEmployee = user.salesRole === "SALES" || (user.salesRole === "MANAGER" && user.managerType !== "MANAGER_ONLY");
  const canViewOverview =
    user.salesRole === "PRIMARY_ADMIN" ||
    user.salesRole === "ADMIN" ||
    user.salesRole === "MANAGER";
  const current = isEmployee ? await getCurrentAttendance() : null;
  const overview = canViewOverview ? await getAttendanceOverview() : [];
  return <main className="attendance-shell"><section className="attendance-content"><WorkspacePageHeader title="Attendance" backHref="/workspace"/>{current && <AttendanceControls initialOpen={Boolean(current.attendance)} startedAt={current.attendance?.startedAt.toISOString()} gpsEnabled={current.settings.gpsTrackingEnabled || current.settings.attendanceGeofenceEnabled} attendanceEnabled={current.settings.attendanceEnabled} pointCount={current.attendance?._count.locationPoints ?? 0} />}{overview.length > 0 && <section className="attendance-overview"><div><h2>Team attendance</h2><p className="muted">{user.salesRole==="MANAGER"?"Current attendance status of your assigned sales team.":"Current attendance state for your company."}</p></div><div className="attendance-list">{overview.map((employee) => { const open = employee.attendances[0]; return <article key={employee.id}><div className="avatar">{employee.name.charAt(0)}</div><div><strong>{employee.name}</strong><span>{employee.salesRole === "MANAGER" ? "Manager" : "Sales"} · {employee.isActive ? "Active employee" : "Inactive employee"}</span></div><div className={open ? "working-pill" : "off-pill"}>{open ? `Working since ${open.startedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })} IST · ${open._count.locationPoints} points` : "Not working"}</div></article>; })}</div></section>}</section></main>;
}
