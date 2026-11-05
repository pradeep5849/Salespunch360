"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { printPdfPageImages } from "./print-page-images";
import { preparePrintPdf, isShareCancellation } from "./share-print-file";
export function PaymentPreview({
  id,
  type,
  number,
  label = "Payment receipt preview",
  backHref,
}: {
  id: string;
  type: string;
  number: string;
  label?: string;
  backHref?: string;
}) {
  const [theme, setTheme] = useState("REGULAR"),
    [color, setColor] = useState("#988ee2"),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);
  async function shareFiles(files: File[]) {
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: number });
        setMessage(
          "Files handed to your selected app. Delivery is not confirmed.",
        );
      } else {
        for (const file of files) {
          const url = URL.createObjectURL(file),
            link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        setMessage(
          "File downloads requested. Attach them from your messaging app.",
        );
      }
    } catch (error) {
      setMessage(
        isShareCancellation(error)
          ? "Sharing cancelled."
          : "Could not share. Try saving the PDF.",
      );
    }
  }
  const base = `/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    query = new URLSearchParams({ theme, color }),
    src = `${base}?${query}`;
  async function prepare() {
    setBusy(true);
    setMessage("");
    try {
      setFile(await preparePrintPdf(`${src}&format=pdf`, number));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not prepare PDF.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Payment preview">
      <header>
        <h2>{label}</h2>
        <button
          type="button"
          onClick={() => frame.current?.contentWindow?.print()}
        >
          Print
        </button>
        <Link href="/workspace/account/settings/print-templates">
          Print settings
        </Link>
      </header>
      <label>
        Theme
        <select
          disabled={busy}
          value={theme}
          onChange={(event) => {
            setTheme(event.target.value);
            setFile(null);
            setImages([]);
          }}
        >
          {["REGULAR", "MODERN", "CLASSIC", "MINIMAL"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Colour
        <input
          disabled={busy}
          type="color"
          value={color}
          onChange={(event) => {
            setColor(event.target.value);
            setFile(null);
            setImages([]);
          }}
        />
      </label>
      <iframe
        ref={frame}
        src={src}
        title={`${number} payment preview`}
        style={{ width: "100%", height: "70vh", border: "1px solid #ccc" }}
      />
      <p>
        Preview appearance is temporary. Opening, printing and sharing a saved
        document never posts another transaction.
      </p>
      <button type="button" disabled={busy} onClick={() => void prepare()}>
        {busy ? "Preparing…" : "Prepare PDF for sharing"}
      </button>
      {file && (
        <>
          <button type="button" onClick={() => void shareFiles([file])}>
            Share PDF
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                setImages(await printPdfPageImages(file));
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Could not prepare images.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Prepare images
          </button>
        </>
      )}
      {images.length > 0 && (
        <button type="button" onClick={() => void shareFiles(images)}>
          Share all {images.length} page images
        </button>
      )}

      <a href={`${src}&format=pdf`} download>
        Save PDF
      </a>
      <Link href={backHref ?? `/workspace/account/settlements/${id}`}>
        Close preview
      </Link>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
