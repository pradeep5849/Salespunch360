import type { SVGProps } from "react";

export type AccountIconName = "home" | "dashboard" | "items" | "projects" | "menu" | "bell";

const paths: Record<AccountIconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  items: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7v10l8 4 8-4V7M12 11v10"/></>,
  projects: <><path d="M4 7h6l2 2h8v10H4z"/><path d="M4 7V5h6l2 2"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
};

export function AccountIcon({name,...props}:{name:AccountIconName}&SVGProps<SVGSVGElement>){return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>}
