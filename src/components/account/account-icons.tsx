import type { SVGProps } from "react";

export type AccountIconName = "home" | "dashboard" | "items" | "projects" | "menu" | "bell" | "plus" | "report" | "settings" | "grid" | "store" | "stock" | "search" | "filter" | "share" | "more";

const paths: Record<AccountIconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  items: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7v10l8 4 8-4V7M12 11v10"/></>,
  projects: <><path d="M4 7h6l2 2h8v10H4z"/><path d="M4 7V5h6l2 2"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>, report: <><path d="M5 20V10M12 20V4M19 20v-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A7 7 0 0 0 15 6l-.3-2.5h-4L10.4 6A7 7 0 0 0 8 7L5.7 6 3.8 9.5l2 1.5a7 7 0 0 0 0 2l-2 1.5L5.7 18l2.3-1a7 7 0 0 0 2.4 1l.3 2.5h4L15 18a7 7 0 0 0 2.4-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .2-1Z"/></>,
  grid: <><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></>,
  store: <><path d="M4 10v10h16V10M3 10l2-6h14l2 6M8 20v-6h8v6"/></>, stock: <><path d="M4 19h16M6 16l4-5 3 2 5-7"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>, filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
  share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>, more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
};

export function AccountIcon({name,...props}:{name:AccountIconName}&SVGProps<SVGSVGElement>){return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>}
