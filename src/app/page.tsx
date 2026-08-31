import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const Icon = ({ children }: { children: React.ReactNode }) => <span className="feature-icon" aria-hidden="true">{children}</span>;
const features = [
  ["◉", "Attendance", "GPS-based attendance with smart geofencing"], ["⌖", "Live Tracking", "Real-time routes and location history"],
  ["♟", "Customers", "Customer records with visit check-in and out"], ["▥", "Leads & Pipeline", "Capture, assign and track leads to close"],
  ["▤", "Reports", "Clear field and performance insights"], ["▣", "Billing", "Simple subscriptions and seat management"],
];
export default function Home() {
 return <main className="public-site">
  <header className="public-header"><BrandLogo/><nav aria-label="Main navigation"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#demo">Demo</a><a href="#resources">Resources</a><a href="#contact">Contact</a></nav><div className="header-actions"><Link className="text-link" href="/sign-in">Login</Link><Link className="button small" href="/register">Start Free Trial</Link></div><details className="mobile-menu"><summary aria-label="Open navigation"><i/><i/><i/></summary><div><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#demo">Demo</a><a href="#resources">Resources</a><a href="#contact">Contact</a><Link href="/sign-in">Login</Link><Link className="button" href="/register">Start Free Trial</Link></div></details></header>
  <section className="hero"><div className="hero-copy"><p className="hero-kicker"><span/> Field force management, simplified</p><h1>Track. Punch.<br/><em>Perform.</em></h1><p className="hero-subtitle">Complete field force management for modern businesses</p><ul><li>Real-time attendance & GPS tracking</li><li>Customer check-in & check-out</li><li>Lead management & pipeline</li><li>Targets, performance & reports</li></ul><div className="hero-actions"><Link className="button" href="/register">Start Free Trial <span>→</span></Link><a className="button secondary" href="#demo">Book a Demo</a></div><p className="no-card">✓ 15-day trial &nbsp; • &nbsp; No credit card required</p></div>
   <div className="hero-visual" aria-label="SalesPunch360 mobile field tracking preview"><div className="glow"/><div className="float-card fc-one"><b>⌖</b><span>Live Tracking</span></div><div className="float-card fc-two"><b>◎</b><span>Check-in</span></div><div className="float-card fc-three"><b>▥</b><span>Targets</span></div><div className="phone"><div className="phone-top"/><div className="map"><span className="pin p1">●</span><span className="pin p2">●</span><svg viewBox="0 0 260 290"><path d="M35 220 C70 175 72 245 115 185 S135 105 190 80 220 50 230 30"/></svg></div><div className="phone-status"><small>Attendance</small><strong>00:45:12</strong><span>● Active</span><button>Check-out</button></div></div></div>
  </section>
  <section className="trust-strip"><span>Built for teams that work in the field</span><b>GPS-enabled</b><b>Secure by design</b><b>Real-time insights</b></section>
  <section id="features" className="features"><div className="section-heading-public"><p>EVERYTHING YOU NEED</p><h2>Manage your entire<br/><em>field force</em> in one place</h2><span>From the first punch-in to the final report, give your company a clear view of field activity.</span></div><div className="feature-grid">{features.map(([icon,title,copy])=><article key={title}><Icon>{icon}</Icon><h3>{title}</h3><p>{copy}</p><a href="#demo">Learn more →</a></article>)}</div></section>
  <section id="demo" className="cta"><div><p>START MOVING SMARTER</p><h2>Ready to transform your field operations?</h2><span>Get your team up and running in minutes.</span></div><Link className="button light" href="/register">Start your free trial →</Link></section>
  <footer id="contact"><BrandLogo/><p>© 2026 SalesPunch360. Track. Punch. Perform.</p><div><a href="#features">Features</a><a href="#contact">Contact</a><Link href="/sign-in">Login</Link></div></footer>
 </main>;
}
