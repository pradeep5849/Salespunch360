import Image from "next/image";
import Link from "next/link";

/** Canonical public/auth wordmark. The bounded intrinsic image prevents oversized fallback rendering. */
export function BrandLogo({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return <Link href={href} className={`brand-logo${inverse ? " inverse" : ""}`} aria-label="SalesPunch360 home">
    <Image src="/salespunch360-wordmark.webp" width={281} height={50} sizes="(max-width: 600px) 124px, 158px" priority alt="SalesPunch360" />
  </Link>;
}
