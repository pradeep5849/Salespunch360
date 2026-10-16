"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveReportFavourite } from "@/app/actions/report-favourites";
type Entry = { key: string; name: string; group: string };
export function ReportHub({
  catalogue,
  initialFavourites,
  query,
}: {
  catalogue: Entry[];
  initialFavourites: string[];
  query: string;
}) {
  const [search, setSearch] = useState(""),
    [favourites, setFavourites] = useState(initialFavourites),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const visible = catalogue.filter((x) =>
    `${x.name} ${x.group} ${x.key}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  function toggle(key: string) {
    setError("");
    startTransition(async () => {
      try {
        setFavourites(
          await saveReportFavourite(key, !favourites.includes(key)),
        );
      } catch {
        setError(
          "Unable to update favourites. Your saved selection is unchanged; try again.",
        );
      }
    });
  }
  function rows(entries: Entry[]) {
    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {entries.map((entry) => (
          <li
            key={entry.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".75rem",
              marginBottom: ".5rem",
            }}
          >
            <Link
              href={`/workspace/account/reports/${entry.key}?${query}`}
              style={{ flex: 1, minHeight: 44, padding: ".75rem" }}
            >
              {entry.name}
            </Link>
            <button
              type="button"
              aria-label={`${favourites.includes(entry.key) ? "Remove" : "Add"} ${entry.name} ${favourites.includes(entry.key) ? "from" : "to"} favourites`}
              aria-pressed={favourites.includes(entry.key)}
              disabled={pending}
              onClick={() => toggle(entry.key)}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              {favourites.includes(entry.key) ? "★" : "☆"}
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section aria-label="Report catalogue">
      <label htmlFor="report-search">Search reports</label>
      <input
        id="report-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by report or group"
      />
      {error && <p role="alert">{error}</p>}
      <p role="status">{visible.length} reports available</p>
      {visible.some((x) => favourites.includes(x.key)) && (
        <section aria-label="Favourite reports">
          <h2>Favourites</h2>
          {rows(visible.filter((x) => favourites.includes(x.key)))}
        </section>
      )}
      {[...new Set(visible.map((x) => x.group))].map((group) => (
        <section key={group} aria-label={`${group} reports`}>
          <h2>{group}</h2>
          {rows(visible.filter((x) => x.group === group))}
        </section>
      ))}
      {!visible.length && <p>No reports match your search.</p>}
    </section>
  );
}
