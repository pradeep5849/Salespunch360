"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { changeOrderAction } from "@/app/actions/project-costing";
import { ActionFeedbackForm } from "./action-feedback-form";
type Change = {id: string; changeOrderNumber: string; title: string; description: string | null; valueDelta: string; estimatedCostDelta: string; status: string; createdById: string};
function Save({name, value, children}: {name?: string; value?: string; children: string}) {
  const {pending} = useFormStatus();
  return <button disabled={pending} name={name} value={value}>{pending ? "Saving…" : children}</button>;
}
function Fields({row}: {row?: Change}) {
  return <><label>Title<input name="title" defaultValue={row?.title} maxLength={240} required /></label>
    <label>Description<textarea name="description" defaultValue={row?.description ?? ""} maxLength={5000} /></label>
    <label>Contract value change<input name="valueDelta" defaultValue={row?.valueDelta} inputMode="decimal" pattern="-?[0-9]{1,16}([.][0-9]{1,2})?" required /></label>
    <label>Estimated cost change<input name="estimatedCostDelta" defaultValue={row?.estimatedCostDelta} inputMode="decimal" pattern="-?[0-9]{1,16}([.][0-9]{1,2})?" required /></label></>;
}
export function ProjectChangeOrders({projectId, changes, canEdit, canApprove, actorId}: {projectId: string; changes: Change[]; canEdit: boolean; canApprove: boolean; actorId: string}) {
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const success = () => router.refresh();
  return <section className="stack"><h2>Change Orders / Extra Work</h2>
    {canEdit && <ActionFeedbackForm action={changeOrderAction} className="account-card stack" onSuccess={() => {setRequestKey(crypto.randomUUID()); success();}}>
      <input type="hidden" name="operation" value="create" /><input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="idempotencyKey" value={requestKey} />
      <fieldset className="stack" onChange={() => setRequestKey(crypto.randomUUID())}><legend>New extra work</legend><Fields /></fieldset>
      <Save>Create draft</Save>
    </ActionFeedbackForm>}
    {changes.map(row => <article key={row.id} className="account-card stack"><b>{row.changeOrderNumber} · {row.title}</b>
      <p>{row.status} · Value {row.valueDelta} · Cost {row.estimatedCostDelta}</p>
      {canEdit && row.status === "DRAFT" && <>
        <details><summary>Edit draft</summary><ActionFeedbackForm action={changeOrderAction} className="stack" onSuccess={success}>
          <input type="hidden" name="operation" value="edit" /><input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="changeOrderId" value={row.id} /><Fields row={row} /><Save>Save draft</Save>
        </ActionFeedbackForm></details>
        <ActionFeedbackForm action={changeOrderAction} onSuccess={success}>
          <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="changeOrderId" value={row.id} />
          <Save name="operation" value="PENDING_APPROVAL">Submit</Save><Save name="operation" value="CANCELLED">Cancel</Save>
        </ActionFeedbackForm></>}
      {canEdit && row.status === "PENDING_APPROVAL" && <ActionFeedbackForm action={changeOrderAction} onSuccess={success}>
        <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="changeOrderId" value={row.id} />
        {canApprove && row.createdById !== actorId && <><Save name="operation" value="APPROVED">Approve</Save><Save name="operation" value="REJECTED">Reject</Save></>}
        <Save name="operation" value="CANCELLED">Cancel</Save>
        {canApprove && row.createdById === actorId && <p>A different administrator must approve this change order.</p>}
      </ActionFeedbackForm>}
    </article>)}
    {!changes.length && <p>No change orders.</p>}
  </section>;
}
