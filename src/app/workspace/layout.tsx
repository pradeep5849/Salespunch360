import { requireUser } from "@/lib/auth/authorization";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
