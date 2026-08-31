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

export function AttendanceControls({ initialOpen, startedAt, gpsEnabled, attendanceEnabled, pointCount }: { initialOpen: boolean; startedAt?: string; gpsEnabled: boolean; attendanceEnabled: boolean; pointCount: number }) {
  const [message, setMessage] = useState<string>();
  const [locationState, setLocationState] = useState(initialOpen&&gpsEnabled ? "Starting GPS tracking…" : gpsEnabled ? "GPS required to start" : "GPS tracking off");
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
      });
    }, (error) => setLocationState(error.code === 1 ? "Location permission denied" : error.code === 3 ? "Location request timed out" : "Location unavailable"), { enableHighAccuracy: true, timeout: LOCATION_CONFIG.watchTimeoutMs, maximumAge: LOCATION_CONFIG.watchMaximumAgeMs });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsEnabled, initialOpen, trackingStopped]);

  const submit = (ending: boolean) => startTransition(async () => {
    setMessage(gpsEnabled ? "Requesting a fresh location…" : undefined);
    let location:LocationMeasurement|undefined;
    if(gpsEnabled){try{location=await currentPosition();}catch(error){setMessage(error instanceof Error?error.message:"Location is required.");return;}}
    const result = ending ? await endAttendanceAction(location) : await startAttendanceAction(location);
    if (!result.ok) setMessage(result.error); else router.refresh();
  });

  return <section className={`attendance-card compact ${initialOpen ? "open" : ""}`}><div className="attendance-summary"><div><span className="attendance-state">{initialOpen ? "ON ATTENDANCE" : "ATTENDANCE OFF"}</span><strong>{initialOpen&&startedAt?`Started ${new Date(startedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`:"Ready to start"}</strong><small>{locationState}{initialOpen&&gpsEnabled?` · ${pointCount} points`:""}</small></div><button className={initialOpen?"end-button":"start-button"} disabled={pending||(!initialOpen&&!attendanceEnabled)} onClick={()=>submit(initialOpen)}>{pending?"Please wait…":initialOpen?"End Attendance":attendanceEnabled?"Start Attendance":"Attendance disabled"}</button></div>{message&&<p className="attendance-message" role="status">{message}</p>}</section>;
}
