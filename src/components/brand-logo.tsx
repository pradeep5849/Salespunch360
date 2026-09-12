import Link from "next/link";

export function BrandLogo({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return <Link href={href} className={`brand-logo${inverse ? " inverse" : ""}`} aria-label="SalesPunch360 home">
    <span className="brand-mark" aria-hidden>SP</span>
    <span className="brand-wordmark">SalesPunch<span>360</span></span>
  </Link>;
}
