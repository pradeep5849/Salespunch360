import { requirePermission } from "@/lib/auth/authorization";
import { projectMaterialContextForActor } from "@/lib/account/project-material-service";
import type { ProjectActor } from "@/lib/account/projects";
import { ProjectMaterialForms } from "@/components/account/project-material-forms";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    productId?: string;
    sourcePage?: string;
    historyPage?: string;
  }>;
}) {
  const actor = (await requirePermission(
    "ACCOUNT_PROJECT_MATERIAL_VIEW",
  )) as ProjectActor;
  const query = await searchParams;
  const page = (value?: string) =>
    Math.max(
      1,
      Math.min(100000, Number.isSafeInteger(Number(value)) ? Number(value) : 1),
    );
  const context = await projectMaterialContextForActor(actor, {
    projectId: query.projectId,
    productId: query.productId,
    sourcePage: page(query.sourcePage),
    historyPage: page(query.historyPage),
  });
  return (
    <main>
      <h1>Project Material</h1>
      <p>
        Available material and its original cost are checked again when posting.
        Negative inventory follows General settings; Project consumption, return
        and transfer cannot exceed Project availability.
      </p>
      <ProjectMaterialForms context={JSON.parse(JSON.stringify(context))} />
    </main>
  );
}
