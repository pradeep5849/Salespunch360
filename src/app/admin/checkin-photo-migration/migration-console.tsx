"use client";

import { useRef, useState } from "react";

type Batch = { mode: string; photos: number; objects: number; copied: number; verified: number; failed: number; failures: Array<{ photoId: string; kind: string; reason: string }>; nextCursor: string | null };
type Totals = { photos: number; objects: number; copied: number; verified: number; failed: number; batches: number };
const empty = (): Totals => ({ photos: 0, objects: 0, copied: 0, verified: 0, failed: 0, batches: 0 });

export function MigrationConsole() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"inventory" | "copy">("inventory");
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals>(empty);
  const [cursor, setCursor] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const stop = useRef(false);

  async function diagnose() {
    if (!token || running || diagnosing) return;
    setDiagnosing(true);
    setDiagnostic("");
    try {
      const response = await fetch("/api/internal/checkin-photo-migration/diagnose", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Diagnostic request failed (HTTP ${response.status})`);
      const result = (await response.json()) as { ok: boolean; category: string };
      setDiagnostic(result.ok ? "Firebase bucket metadata access: OK. Object read/write permissions are not yet verified." : `Firebase bucket access failed: ${result.category}`);
    } catch (cause) {
      setDiagnostic(cause instanceof Error ? cause.message : "Diagnostic failed");
    } finally {
      setDiagnosing(false);
    }
  }

  async function run() {
    if (!token || running) return;
    stop.current = false;
    setRunning(true);
    setError("");
    let next = cursor;
    let sum = { ...totals };
    try {
      while (!stop.current) {
        const response = await fetch("/api/internal/checkin-photo-migration", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ apply: mode === "copy", ...(next ? { cursor: next } : {}) }),
        });
        if (!response.ok) throw new Error(`Migration request failed (HTTP ${response.status})`);
        const batch = (await response.json()) as Batch;
        sum = { photos: sum.photos + batch.photos, objects: sum.objects + batch.objects, copied: sum.copied + batch.copied, verified: sum.verified + batch.verified, failed: sum.failed + batch.failed, batches: sum.batches + 1 };
        setTotals(sum);
        if (batch.failures?.length) setFailures(old => [...old, ...batch.failures.map(f => `${f.photoId} / ${f.kind}: ${f.reason}`)].slice(-100));
        next = batch.nextCursor;
        setCursor(next);
        if (!next) { setFinished(true); break; }
        if (batch.failed > 0) { setError("Stopped after failures. Review before resuming."); break; }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Migration failed");
    } finally {
      setRunning(false);
    }
  }
  function reset(nextMode: "inventory" | "copy") {
    if (running) return;
    setMode(nextMode);
    setTotals(empty());
    setCursor(null);
    setFinished(false);
    setFailures([]);
    setError("");
  }

  return <section style={{ display: "grid", gap: 16 }}>
    <label>Temporary migration token (kept only in this page memory)
      <input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} style={{ display: "block", width: "100%", padding: 10 }} />
    </label>
    <fieldset disabled={running} style={{ padding: 12 }}>
      <legend>Operation</legend>
      <label><input type="radio" checked={mode === "inventory"} onChange={() => reset("inventory")} /> Inventory (read-only)</label>
      <label style={{ marginLeft: 20 }}><input type="radio" checked={mode === "copy"} onChange={() => reset("copy")} /> Copy and verify (requires server approval)</label>
    </fieldset>
    <p><strong>Warning:</strong> Copy mode requires CHECKIN_MIGRATION_APPLY=true in Hostinger. Keep STORAGE_DRIVER unchanged until a full verified migration and final write-freeze check. Do not close this tab while running.</p>
    <div style={{ display: "flex", gap: 12 }}>
      <button type="button" disabled={!token || running || finished} onClick={run}>{running ? "Processing..." : cursor ? "Resume" : "Start"}</button>
      <button type="button" disabled={!running} onClick={() => { stop.current = true; }}>Stop after current batch</button>
      <button type="button" disabled={running} onClick={() => reset(mode)}>Reset counts</button>
      <button type="button" disabled={!token || running || diagnosing} onClick={diagnose}>{diagnosing ? "Checking..." : "Test Firebase access"}</button>
    </div>
    {diagnostic && <p role="status">{diagnostic}</p>}
    <div aria-live="polite"><strong>{finished ? "Complete" : running ? "Running" : cursor ? "Paused" : "Not started"}</strong>
      <p>Photos: {totals.photos} · Objects: {totals.objects} · Copied: {totals.copied} · Verified: {totals.verified} · Failed: {totals.failed} · Batches: {totals.batches}</p>
      {error && <p role="alert">{error}</p>}
      {failures.length > 0 && <details><summary>Failure details ({failures.length} shown)</summary><ul>{failures.map((failure, index) => <li key={index}>{failure}</li>)}</ul></details>}
    </div>
  </section>;
}
