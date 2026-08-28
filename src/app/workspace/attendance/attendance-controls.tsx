"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endAttendanceAction, startAttendanceAction, uploadLocationPointAction } from "@/app/actions/attendance";
import { LOCATION_CONFIG } from "@/lib/location/config";

type LocationMeasurement = { latitude: number; longitude: number; accuracyMeters: number };

function currentPosition(): Promise<LocationMeasurement | undefined> {
  if (!("geolocation" in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy }),
    () => resolve(undefined), { enableHighAccuracy: true, timeout: LOCATION_CONFIG.watchTimeoutMs, maximumAge: LOCATION_CONFIG.watchMaximumAgeMs },
  ));
}

export function AttendanceControls({ initialOpen, startedAt, gpsEnabled, attendanceEnabled, pointCount }: { initialOpen: boolean; startedAt?: string; gpsEnabled: boolean; attendanceEnabled: boolean; pointCount: number }) {
  const [message, setMessage] = useState<string>();
  const [locationState, setLocationState] = useState(gpsEnabled ? "Preparing GPS…" : "GPS tracking is off");
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
    setMessage(gpsEnabled ? "Requesting current location…" : undefined);
    const location = gpsEnabled ? await currentPosition() : undefined;
    const result = ending ? await endAttendanceAction(location) : await startAttendanceAction(location);
    if (!result.ok) setMessage(result.error); else router.refresh();
  });

  return <section className={`attendance-card ${initialOpen ? "open" : ""}`}><div><span className="attendance-state">{initialOpen ? "WORK SESSION ACTIVE" : "NOT WORKING"}</span><h2>{initialOpen && startedAt ? `Started ${new Date(startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ready when you are"}</h2><p>{locationState}{initialOpen && gpsEnabled ? ` · ${pointCount} route points stored` : ""}</p></div><button className={initialOpen ? "end-button" : "start-button"} disabled={pending || (!initialOpen && !attendanceEnabled)} onClick={() => submit(initialOpen)}>{pending ? "Please wait…" : initialOpen ? "End attendance" : attendanceEnabled ? "Start attendance" : "Attendance disabled"}</button>{message && <p className="attendance-message" role="status">{message}</p>}<small>Location is collected only during an open work session when company GPS tracking is enabled. Browser tracking may stop if this page is closed or heavily backgrounded.</small></section>;
}
