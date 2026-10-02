"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {AccountIcon, type AccountIconName} from "./account-icons";

export type AccountBottomItem={label:string;href:string;icon:AccountIconName};

export function AccountBottomNav({items}:{items:AccountBottomItem[]}){const pathname=usePathname(),primary=items.some(item=>item.href===pathname);if(!primary)return null;return <nav className="account-bottom-nav" aria-label="Account navigation">{items.map(item=>{const active=pathname===item.href;return <Link key={item.label} href={item.href} className={active?"active":undefined} aria-current={active?"page":undefined}><AccountIcon name={item.icon}/><small>{item.label}</small></Link>})}</nav>}
