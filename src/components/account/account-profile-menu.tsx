"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";

const roleLabels: Record<string, string> = {
  ACCOUNT_ADMIN: "Account Admin",
  ACCOUNTANT: "Accountant",
  PROJECT_MANAGER: "Project Manager",
  DATA_ENTRY: "Data Entry",
  PRIMARY_ADMIN: "Primary Admin",
  ADMIN: "Additional Admin",
  MANAGER: "Manager",
  SALES: "Sales",
};

export function AccountProfileMenu({ userName, role, isPlusPrimaryAdmin=false }: { userName: string; role: string; isPlusPrimaryAdmin?: boolean }) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const open = openPath === pathname;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback((restoreFocus = false) => {
    setOpenPath(null);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    const history = () => close();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("popstate", history);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("popstate", history); };
  }, [open, close]);

  return <div className="account-profile" ref={root}>
    <button ref={trigger} type="button" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpenPath(value => value === pathname ? null : pathname)}><span>{userName.charAt(0).toUpperCase()}</span></button>
    {open && <div role="menu" aria-label="Profile menu"><strong>{userName}</strong><small>{roleLabels[role] ?? role.replaceAll("_", " ").toLowerCase()}</small>{(role==="ACCOUNT_ADMIN"||isPlusPrimaryAdmin)&&<Link role="menuitem" href="/workspace/billing" onClick={() => close()}>{isPlusPrimaryAdmin?"Plus Subscription & Billing":"Account Subscription & Billing"}</Link>}<Link role="menuitem" href="/workspace/change-password" onClick={() => close()}>Profile &amp; password</Link><form action={signOut} onSubmit={() => close()}><button role="menuitem">Sign out</button></form></div>}
  </div>;
}
