import {
  ActionFeedbackForm,
  AccountFieldError,
} from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
import { CustomFieldInput } from "@/components/account/custom-field-input";
import { updateProjectAction } from "@/app/actions/projects";
import { getProject, getProjectFormOptions } from "@/lib/account/projects";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? "";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    [project, options] = await Promise.all([
      getProject(id),
      getProjectFormOptions(id),
    ]);
  if (["COMPLETED", "CLOSED", "CANCELLED"].includes(project.status))
    return (
      <main className="employees-shell">
        <section className="employees-content">
          <WorkspacePageHeader
            title={`${project.projectNumber} · Completed`}
            backHref={`/workspace/account/projects/${id}`}
          />
          <p>
            This project is completed and report-only. It cannot be reopened or
            edited.
          </p>
        </section>
      </main>
    );
  const workflowStatus = project.status === "ON_HOLD" ? "ON_HOLD" : "ACTIVE";
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`Edit ${project.projectNumber}`}
          backHref={`/workspace/account/projects/${id}`}
        />
        <ActionFeedbackForm action={updateProjectAction} className="form-grid">
          <input type="hidden" name="projectId" value={id} />
          <label>
            Project name
            <input name="name" defaultValue={project.name} required />
            <AccountFieldError name="name" />
          </label>
          <label>
            Site name
            <input name="siteName" defaultValue={project.siteName ?? ""} />
          </label>
          <label>
            Site address
            <textarea
              name="siteAddress"
              defaultValue={project.siteAddress ?? ""}
            />
          </label>
          <label>
            Site contact
            <input
              name="siteContactName"
              defaultValue={project.siteContactName ?? ""}
            />
          </label>
          <label>
            Mobile number
            <input
              name="siteContactPhone"
              inputMode="tel"
              defaultValue={project.siteContactPhone ?? ""}
            />
          </label>
          <label>
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={date(project.startDate)}
            />
          </label>
          <label>
            Project value
            <input
              name="projectValue"
              inputMode="decimal"
              defaultValue={project.projectValue.toString()}
              required
            /><AccountFieldError name="projectValue" />
          </label>
          <label>
            Project manager
            <select
              name="projectManagerId"
              defaultValue={project.projectManagerId ?? ""}
            >
              <option value="">Unassigned</option>
              {options.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={workflowStatus}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">Hold</option>
            </select>
          </label>
          {options.customFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={options.customValues[field.fieldKey]}
            />
          ))}
          <SaveSubmitButton>Save project</SaveSubmitButton>
        </ActionFeedbackForm>
      </section>
    </main>
  );
}
