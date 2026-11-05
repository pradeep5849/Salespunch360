import {redirect} from "next/navigation";
import {requireAccountWorkspace} from "@/lib/auth/authorization";
/** Preserve bookmarks through the one role/feature-filtered navigation surface. */
export default async function Page(){await requireAccountWorkspace();redirect("/workspace/account/menu")}
