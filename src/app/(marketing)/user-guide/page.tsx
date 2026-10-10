import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "User Guide",
  description: "SalesPunch360 user guide.",
  alternates: { canonical: "/user-guide" },
};
export default function Page() {
  return (
    <div className="content-page">
      <p className="eyebrow">SUPPORT</p>
      <h1>User Guide</h1>
      <p>
        The full user guide is not available yet. Browse the published resources
        or contact support for help with field sales and business accounts.
      </p>
      <p>
        <Link href="/resources">Browse Resources</Link> ·{" "}
        <Link href="/contact">Get Support</Link>
      </p>
    </div>
  );
}
