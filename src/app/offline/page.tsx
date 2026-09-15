export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(100%, 420px)", textAlign: "center" }}>
        <img src="/salespunch360-logo.png" alt="SalesPunch360" width={96} height={96} />
        <h1>You&apos;re offline</h1>
        <p>Reconnect to the internet to continue using SalesPunch360.</p>
        <a href="/">Try again</a>
      </section>
    </main>
  );
}
