"use client";
import { useActionState } from "react";
import { advancePeriodLockWithFeedback } from "@/app/actions/account-finalization";
export function PeriodLockForm({ id, name, start, end, current }: { id: string; name: string; start: string; end: string; current: string | null }) {
  const [state, action, pending] = useActionState(advancePeriodLockWithFeedback, { message: "", ok: false });
  return <form action={action} className="account-form">
    <input type="hidden" name="financialYearId" value={id}/>
    <p>{name}: {start} – {end}. Current lock: {current ?? "Not set"}. Advancing blocks posting and corrections through the selected date and cannot be undone here.</p>
    <label>Advance through<input name="lockedThrough" type="date" min={current ?? start} max={end} required disabled={pending}/></label>
    <label>Reason<input name="reason" required disabled={pending}/></label>
    <label><input name="confirmed" type="checkbox" required disabled={pending}/>I confirm the selected closing date and understand the restriction.</label>
    <button className="account-danger" disabled={pending}>{pending ? "Saving…" : "Advance lock"}</button>
    {state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
