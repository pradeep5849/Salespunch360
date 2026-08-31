import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return <Link href={href} className={`brand-logo${inverse ? " inverse" : ""}`} aria-label="SalesPunch360 home">
    <Image src="/salespunch360-logo.png" alt="SalesPunch360 — Track. Punch. Perform." width={1536} height={1024} priority />
  </Link>;
}
