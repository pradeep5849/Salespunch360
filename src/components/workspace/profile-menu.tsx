import Link from "next/link";
import {signOut} from "@/app/actions/auth";

export const PROFILE_MENU_ITEMS = ["Company Details", "Change Password", "Logout"] as const;

export function ProfileMenu({name,role}:{name:string;role:"COMPANY_ADMIN"|"MANAGER"|"SALES"}){
  const label=role==="COMPANY_ADMIN"?"Company Admin":role==="MANAGER"?"Manager":"Sales";
  return <details className="profile-menu"><summary className="user-chip"><b>{name.charAt(0).toUpperCase()}</b><span><strong>{name}</strong><small>{label}</small></span></summary><div><Link href="/workspace/company-profile">{PROFILE_MENU_ITEMS[0]}</Link><Link href="/workspace/change-password">{PROFILE_MENU_ITEMS[1]}</Link><form action={signOut}><button>{PROFILE_MENU_ITEMS[2]}</button></form></div></details>;
}
