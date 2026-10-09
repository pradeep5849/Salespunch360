"use server";
import { revalidatePath } from "next/cache";
import { accountAction } from "@/lib/account/action-feedback";
import { createChangeOrder, transitionChangeOrder, updateChangeOrder } from "@/lib/account/project-costing";
export async function changeOrderAction(fd: FormData) {
  return accountAction(async () => {
    const operation = String(fd.get("operation")), projectId = String(fd.get("projectId")), changeOrderId = String(fd.get("changeOrderId") || "");
    const fields = {projectId, title: String(fd.get("title")), description: String(fd.get("description") || "") || undefined,
      valueDelta: String(fd.get("valueDelta")), estimatedCostDelta: String(fd.get("estimatedCostDelta"))};
    if (operation === "create") await createChangeOrder({...fields, idempotencyKey: String(fd.get("idempotencyKey") || "") || undefined});
    else if (operation === "edit") await updateChangeOrder({...fields, changeOrderId});
    else await transitionChangeOrder(projectId, changeOrderId, operation as never);
    revalidatePath(`/workspace/account/projects/${projectId}/costing`);
    revalidatePath(`/workspace/account/projects/${projectId}`);
    revalidatePath("/workspace/account/projects");
  }, "Change order saved");
}
