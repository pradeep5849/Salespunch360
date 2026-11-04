"use client";
import { useState } from "react";
export function GoogleDriveConnectButton({
  configured,
  connected,
}: {
  configured: boolean;
  connected: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={!configured || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/account/backup/google/connect", {
              method: "POST",
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            if (!response.ok) throw new Error();
            const data: unknown = await response.json();
            if (
              !data ||
              typeof data !== "object" ||
              !("url" in data) ||
              typeof data.url !== "string"
            )
              throw new Error();
            const url = new URL(data.url);
            if (
              url.origin !== "https://accounts.google.com" ||
              url.pathname !== "/o/oauth2/v2/auth"
            )
              throw new Error();
            window.location.assign(url.href);
          } catch {
            setError(
              "Could not start the Google connection. Check the configuration or sign in again.",
            );
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Opening Google…"
          : connected
            ? "Change Google account"
            : "Connect Google Drive"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
