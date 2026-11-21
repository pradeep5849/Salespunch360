"use client";
import { useActionState } from "react";
import { restoreMasterWithFeedback } from "@/app/actions/account-finalization";
export function RecycleRestoreForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(restoreMasterWithFeedback, { ok: false, message: "" });
  return <form action={action}><input type="hidden" name="recycleId" value={id}/><button disabled={pending || state.ok}>{pending ? "Restoring…" : state.ok ? "Restored" : "Restore"}</button>{state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}</form>;
}
