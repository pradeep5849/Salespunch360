"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endAttendanceAction, startAttendanceAction, uploadLocationPointAction } from "@/app/actions/attendance";
import { LOCATION_CONFIG } from "@/lib/location/config";

type LocationMeasurement = { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string };

function currentPosition(): Promise<LocationMeasurement> {
  if (!("geolocation" in navigator)) return Promise.reject(new Error("Browser location is unavailable. Use a supported browser and enable location services."));
  return new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(
    ({ coords, timestamp }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, capturedAt: new Date(timestamp).toISOString() }),
    (error) => reject(new Error(error.code===1?"Location permission was denied. Allow location access before starting attendance.":error.code===3?"Location timed out. Move to an open area, enable location services, and try again.":"Current location is unavailable. Enable location services and try again.")), { enableHighAccuracy: true, timeout: LOCATION_CONFIG.watchTimeoutMs, maximumAge: 0 },
  ));
}

export function AttendanceControls({ initialOpen, startedAt, gpsEnabled, geofenceEnabled = false, attendanceEnabled, pointCount, branches = [] }: { initialOpen: boolean; startedAt?: string; gpsEnabled: boolean; geofenceEnabled?: boolean; attendanceEnabled: boolean; pointCount: number; branches?: { id: string; name: string }[] }) {
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0].id : "");
  const [message, setMessage] = useState<string>();
  const [locationState, setLocationState] = useState(initialOpen&&gpsEnabled ? "Starting GPS tracking…" : gpsEnabled ? "GPS required to start" : geofenceEnabled ? "Office location required for clock-in and clock-out" : "GPS tracking off");
  const [trackingStopped, setTrackingStopped] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!initialOpen || !gpsEnabled || trackingStopped || !("geolocation" in navigator)) {
      if (gpsEnabled && !("geolocation" in navigator)) queueMicrotask(() => setLocationState("GPS is unavailable in this browser"));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
      const now = Date.now();
      if (now - lastSent.current < LOCATION_CONFIG.minimumAcceptedIntervalMs) return;
      lastSent.current = now;
      setLocationState("GPS tracking active");
      void uploadLocationPointAction({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, capturedAt: new Date(timestamp).toISOString() }).then((result) => {
        if (!result.ok) {
          setLocationState(result.error ?? "GPS update failed");
          setTrackingStopped(true);
        }
      }).catch(() => { setLocationState("GPS upload was not confirmed. Retry tracking when connected."); setTrackingStopped(true); });
    }, (error) => setLocationState(error.code === 1 ? "Location permission denied" : error.code === 3 ? "Location request timed out" : "Location unavailable"), { enableHighAccuracy: true, timeout: LOCATION_CONFIG.watchTimeoutMs, maximumAge: LOCATION_CONFIG.watchMaximumAgeMs });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsEnabled, initialOpen, trackingStopped]);

  const submit = (ending: boolean) => startTransition(async () => {
    if (!ending && branches.length > 1 && !branchId) { setMessage("Select a branch before starting attendance."); return; }
    const needsLocation = gpsEnabled || geofenceEnabled;
    setMessage(needsLocation ? "Requesting a fresh location…" : undefined);
    try {
      let location: LocationMeasurement | undefined;
      if (needsLocation) {
        try { location = await currentPosition(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Current location is unavailable."); return; }
      }
      const result = ending ? await endAttendanceAction(location) : await startAttendanceAction(location, branchId || undefined);
      if (!result.ok) { setMessage(result.error); return; }
      if (!result.confirmedAt) { setMessage("Attendance response needs verification. Refresh before trying again."); router.refresh(); return; }
      const time = new Date(result.confirmedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
      setMessage(`Attendance ${ending ? "stopped" : "started"} successfully at ${time} IST.`);
      router.refresh();
    } catch {
      setMessage("Attendance was not confirmed. Check connection and refresh the current status before trying again.");
      router.refresh();
    }
  });

  return <section className={`attendance-card compact ${initialOpen ? "open" : ""}`}>{!initialOpen && branches.length > 1 && <label data-branch-ui>Attendance branch<select value={branchId} disabled={pending} onChange={event=>setBranchId(event.target.value)}><option value="">Select branch</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}<div className="attendance-summary"><div><span className="attendance-state">{initialOpen ? "ON ATTENDANCE" : "ATTENDANCE OFF"}</span><strong>{initialOpen&&startedAt?`Started ${new Date(startedAt).toLocaleTimeString("en-IN", {hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"})+" IST"}`:"Ready to start"}</strong><small>{locationState}{initialOpen&&gpsEnabled?` · ${pointCount} points`:""}</small></div><button className={initialOpen?"end-button":"start-button"} disabled={pending||(!initialOpen&&!attendanceEnabled)} onClick={()=>submit(initialOpen)}>{pending?"Please wait…":initialOpen?"End Attendance":attendanceEnabled?"Start Attendance":"Attendance disabled"}</button></div>{initialOpen&&gpsEnabled&&trackingStopped&&<button disabled={pending} onClick={()=>{lastSent.current=0;setTrackingStopped(false);}}>Retry GPS tracking</button>}{message&&<p className="attendance-message" role="status">{message}</p>}</section>;
}
