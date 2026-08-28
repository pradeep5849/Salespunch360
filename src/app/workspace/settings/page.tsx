import type { Metadata } from "next";
import Link from "next/link";
import { updateOperationsAction } from "@/app/actions/attendance";
import { getCompanyOperations } from "@/lib/attendance/service";

export const metadata: Metadata = { title: "Operational settings" };

export default async function SettingsPage() {
  const settings = await getCompanyOperations();
  if (!settings) return null;
  return <main className="settings-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="settings-content"><p className="eyebrow">Company administration</p><h1>Operational settings</h1><p className="muted">Control attendance, location collection, and customer-visit flow.</p><form action={updateOperationsAction} className="settings-card"><label><div><strong>Attendance</strong><span>Allow active Managers and Sales employees to start work sessions.</span></div><input type="checkbox" name="attendanceEnabled" defaultChecked={settings.attendanceEnabled} /></label><label><div><strong>GPS Tracking</strong><span>Collect continuous route points only while attendance is open.</span></div><input type="checkbox" name="gpsTrackingEnabled" defaultChecked={settings.gpsTrackingEnabled} /></label><label><div><strong>Checkout required</strong><span>Require employees to finish a customer visit before another check-in.</span></div><input type="checkbox" name="checkoutRequiredBeforeNextCheckIn" defaultChecked={settings.checkoutRequiredBeforeNextCheckIn} /></label><button className="primary-button">Save settings</button></form><p className="privacy-note">Visit check-in and checkout always require current GPS, independently of continuous GPS Tracking.</p></section></main>;
}
