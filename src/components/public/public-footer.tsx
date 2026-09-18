import Link from "next/link";
import {BrandLogo} from "@/components/brand-logo";

export function PublicFooter(){
  return <footer className="public-footer reference-footer">
    <div className="footer-grid">
      <div className="footer-brand">
        <BrandLogo inverse/>
        <p>One platform for field sales tracking and business account management—built to help growing teams stay connected and in control.</p>
        <div className="footer-socials" aria-label="Social links"><span>in</span><span>f</span><span>▶</span><span>◎</span></div>
      </div>
      <div><b>Product</b><Link href="/products/salespunch360">Sales Tracking</Link><Link href="/products/account">Account & Billing</Link><Link href="/products/plus">SalesPunch360 Plus</Link><Link href="/features">Features</Link><Link href="/pricing">Pricing</Link></div>
      <div><b>Company</b><Link href="/about">About Us</Link><Link href="/contact">Contact</Link><Link href="/demo">Book a Demo</Link><Link href="/security">Security</Link></div>
      <div><b>Resources</b><Link href="/resources">Resources</Link><Link href="/resources/faq">FAQs</Link><Link href="/apps">Web & Android</Link><Link href="/android">Android App</Link></div>
      <div className="footer-app"><b>Get the App</b><p>Manage your field team wherever work takes you.</p><Link className="app-download" href="/android"><span>▶</span><small>GET IT ON<strong>Android App</strong></small></Link><div className="qr-preview" aria-label="QR code placeholder"><span>▦</span><small>Scan to<br/>open app page</small></div></div>
    </div>
    <div className="footer-links-row"><Link href="/sign-in">Login</Link><Link href="/register">Start Free Trial</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></div>
    <div className="footer-base"><span>© {new Date().getFullYear()} SalesPunch360. All rights reserved.</span><span>Track · Manage · Grow · Together</span></div>
  </footer>
}