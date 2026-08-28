import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function Home() {
  redirect((await getAuthenticatedUser()) ? "/workspace" : "/sign-in");
}
