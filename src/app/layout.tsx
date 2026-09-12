import type { Metadata } from "next";
import "./globals.css";
import "./functional-polish.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.salespunch360.com"),
  title: { default: "SalesPunch360", template: "%s | SalesPunch360" },
  description: "Run field sales, business accounts, projects, inventory and branches from one connected platform.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SalesPunch360",
    url: "https://www.salespunch360.com",
    title: "SalesPunch360 — Field Sales and Business Accounts",
    description: "One connected platform for field sales, business accounts, or both together.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
