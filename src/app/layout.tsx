import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SalesPunch360", template: "%s | SalesPunch360" },
  description: "A secure, tenant-aware sales operations platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
