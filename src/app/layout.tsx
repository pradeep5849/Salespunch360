import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./functional-polish.css";
import "./pwa.css";
import { PwaRegister } from "./pwa-register";
import { PwaInstall } from "./pwa-install";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.salespunch360.com"),
  title: { default: "SalesPunch360", template: "%s | SalesPunch360" },
  description: "Run field sales, business accounts, projects, inventory and branches from one connected platform.",
  manifest: "/manifest.webmanifest",
  applicationName: "SalesPunch360",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SalesPunch360" },
  icons: { icon: "/salespunch360-logo.png", apple: "/salespunch360-logo.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SalesPunch360",
    url: "https://www.salespunch360.com",
    title: "SalesPunch360 — Field Sales and Business Accounts",
    description: "One connected platform for field sales, business accounts, or both together.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f172a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PwaInstall /><PwaRegister /></body></html>;
}
