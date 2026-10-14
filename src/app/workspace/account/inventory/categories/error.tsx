"use client";
import Link from "next/link";
export default function CategoryLoadError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="account-card">
      <h1>Categories could not be loaded</h1>
      <p>Check your connection and access, then try again.</p>
      <button type="button" onClick={reset}>
        Retry categories
      </button>
      <Link href="/workspace/account/inventory">Back to items</Link>
    </section>
  );
}
