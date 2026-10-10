"use client";
import {useFormStatus} from "react-dom";
import {ActionFeedbackForm} from "./action-feedback-form";
import {completeProjectAction} from "@/app/actions/projects";
function Controls({services}: {services: Array<{id: string; name: string; sacCode: string | null; taxRate: string | null}>}) {
  const {pending} = useFormStatus();
  return <fieldset disabled={pending}>
    <label>Final invoice service / SAC
      <select name="billingServiceId" defaultValue="">
        <option value="">Reuse the existing invoice service where unambiguous</option>
        {services.map(x => <option key={x.id} value={x.id}>{x.name} · SAC {x.sacCode ?? "—"} · GST {x.taxRate ?? "0"}%</option>)}
      </select>
    </label>
    <p>If a balance remains and there is no single existing service, choose its billing service. Closing posts only the uninvoiced balance, applies available advances and makes the project report-only. Earlier invoices are retained.</p>
    <button type="submit">{pending ? "Closing project…" : "Complete project"}</button>
  </fieldset>;
}
export function ProjectCloseForm({projectId, services}: {projectId: string; services: Array<{id: string; name: string; sacCode: string | null; taxRate: string | null}>}) {
  return <ActionFeedbackForm action={completeProjectAction}>
    <input type="hidden" name="projectId" value={projectId} />
    <Controls services={services} />
  </ActionFeedbackForm>;
}
