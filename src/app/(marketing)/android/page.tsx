export const metadata={title:"SalesPunch360 Android App",description:"Field Sales, Accounts and connected Plus workspaces across Web and Android.",alternates:{canonical:"/android"}};
import {redirect} from "next/navigation";
import Link from "next/link";
import {PageHero} from "@/components/public/marketing-ui";
import {validatedGooglePlayUrl} from "@/lib/public-site/android-url";

export default function Page(){
  const playUrl=validatedGooglePlayUrl(process.env.GOOGLE_PLAY_URL);
  if(playUrl)redirect(playUrl);
  return <>
    <PageHero eyebrow="SalesPunch360 for Android" title="Sales and accounts, ready for every role." copy="Use native Android field workflows with SalesPunch360, responsive business management with SalesPunch360 Account, or both role-controlled workspaces with SalesPunch360 Plus.">
      <Link className="button" href="/register">Start Free Trial</Link><Link className="button secondary" href="/sign-in">Secure Login</Link>
    </PageHero>
    <section className="card-grid">
      <article className="card"><p className="eyebrow">Field Sales & CRM</p><h2>SalesPunch360 on Android</h2><p>Attendance, location permissions, route tracking, customer check-ins, photo capture, leads, follow-ups, targets and notifications in a native field-sales experience.</p><Link className="learn" href="/products/salespunch360">Explore Field Sales →</Link></article>
      <article className="card"><p className="eyebrow">Accounts & Business</p><h2>Account on Android</h2><p>Responsive business management across Web and Android for accounts, projects, inventory, GST, documents and reports—according to role.</p><Link className="learn" href="/products/account">Explore Account →</Link></article>
      <article className="card"><p className="eyebrow">Two connected workspaces</p><h2>Plus on Android</h2><p>Authorized users can move between the native Sales field experience and the responsive Account experience. Each person sees only assigned workspaces and features.</p><Link className="learn" href="/products/plus">Explore Plus →</Link></article>
    </section>
    <section className="app-promo"><div><p className="eyebrow">Role-based access</p><h2>One Company context. The appropriate experience for each person.</h2><p>Sales-only users remain in Sales. Account-only users remain in Account. Plus users can switch only when both roles are authorized, with Branch permissions respected throughout.</p></div><div className="button-row"><Link className="button" href="/products">Explore Products</Link><Link className="button secondary" href="/contact">Contact Us</Link></div></section>
  </>;
}
