import type {Metadata} from "next";
import Link from "next/link";

export const metadata:Metadata={title:"Industries",description:"See how SalesPunch360 supports field sales and business operations across growing industries.",alternates:{canonical:"/industries"}};

const industries=[
["Retail & FMCG","Track field visits, leads, follow-ups and sales activity across territories."],
["Distributors","Give field teams a structured workflow for customer visits, follow-ups and reporting."],
["Pharma & Healthcare","Organize field activity, customer follow-ups and team visibility from one platform."],
["Electronics","Keep sales visits, leads, follow-ups and business activity connected."],
["Furniture","Manage field opportunities and customer follow-ups while keeping business operations organized."],
["Automotive","Track sales activity, customer visits, follow-ups and team performance."],
["Food & Beverage","Coordinate field sales visits, leads and follow-ups across growing teams."],
["Construction","Bring field sales activity, customer follow-ups and management reporting together."]
] as const;

export default function IndustriesPage(){return <main className="content-page"><header className="section-heading center"><p className="eyebrow">BUILT FOR EVERY INDUSTRY</p><h1>Works for Your Business</h1><p>From retail to growing field-sales organizations, SalesPunch360 adapts to the way your team works.</p></header><section className="card-grid">{industries.map(([name,description])=><article className="card" key={name}><h2>{name}</h2><p>{description}</p><Link className="learn" href="/features">Explore features →</Link></article>)}</section><section className="section-heading center"><h2>Need a Connected Sales and Business Workflow?</h2><p>Start with SalesPunch360 and choose the product access that fits your team.</p><div className="cta-row"><Link className="primary-cta" href="/register">Start Free Trial</Link><Link className="secondary-cta" href="/contact">Contact Us</Link></div></section></main>}