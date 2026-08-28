import type { Metadata } from "next";
import Link from "next/link";
import { updateOperationsAction } from "@/app/actions/attendance";
import { getCompanyOperations } from "@/lib/attendance/service";

export const metadata: Metadata = { title: "Operational settings" };

export default async function SettingsPage() {
  const settings = await getCompanyOperations();
  if (!settings) return null;
  return <main className="settings-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="settings-content"><p className="eyebrow">Company administration</p><h1>Operational settings</h1><p className="muted">Control attendance and location collection for your company.</p><form action={updateOperationsAction} className="settings-card"><label><div><strong>Attendance</strong><span>Allow active Managers and Sales employees to start work sessions.</span></div><input type="checkbox" name="attendanceEnabled" defaultChecked={settings.attendanceEnabled} /></label><label><div><strong>GPS Tracking</strong><span>Collect route points only while an employee has open attendance.</span></div><input type="checkbox" name="gpsTrackingEnabled" defaultChecked={settings.gpsTrackingEnabled} /></label><button className="primary-button">Save settings</button></form><p className="privacy-note">Turning GPS off stops new route uploads and preserves existing history. Employees can still end an open attendance session.</p></section></main>;
}
