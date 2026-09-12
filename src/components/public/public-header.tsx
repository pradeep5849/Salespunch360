"use client";
import Link from "next/link";
import {useState} from "react";
import {BrandLogo} from "@/components/brand-logo";
import {features} from "@/lib/public-site/content";

const products=[["SalesPunch360","/products/salespunch360"],["SalesPunch360 Account","/products/account"],["SalesPunch360 Plus","/products/plus"],["Compare products","/compare"]];
export function PublicHeader(){const [open,setOpen]=useState(false);return <header className="public-header"><div className="nav-wrap"><BrandLogo/><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="public-navigation">{open?"Close":"Menu"}</button><nav id="public-navigation" className={open?"open":""} aria-label="Primary navigation">
  <details><summary>Products</summary><div className="nav-pop">{products.map(([n,h])=><Link key={h} href={h}>{n}</Link>)}</div></details>
  <details className="mega"><summary>Features</summary><div className="nav-pop">{["Field sales","Business","Accounting"].map(group=><section key={group}><b>{group}</b>{features.filter(f=>f.group===group).map(f=><Link key={f.slug} href={`/features/${f.slug}`}>{f.title}</Link>)}</section>)}</div></details>
  <Link href="/pricing">Pricing</Link><Link href="/compare">Compare</Link>
  <details><summary>Resources</summary><div className="nav-pop"><Link href="/resources">Resources</Link><Link href="/resources/faq">FAQs</Link><Link href="/security">Security</Link><Link href="/apps">Apps / Android</Link><Link href="/contact">Contact</Link></div></details>
  <Link href="/android">Android App</Link><div className="nav-actions"><Link href="/sign-in">Login</Link><Link className="button secondary" href="/demo">Book a Demo</Link><Link className="button" href="/register">Start Free Trial</Link></div>
 </nav></div></header>}
