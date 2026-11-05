"use client";
import { useState } from "react";
import { uploadAccountImport } from "@/app/actions/account-finalization";

export function ImportUploadForm({
  initialType,
  types,
}: {
  initialType: string;
  types: string[];
}) {
  const [type, setType] = useState(initialType);
  return (
    <form action={uploadAccountImport} className="account-form">
      <label>
        Import type
        <select
          name="type"
          required
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {types.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <p>
        <a href={`/api/account/utilities/templates/${type}?format=xlsx`}>
          Download {type.replaceAll("_", " ").toLowerCase()} Excel sample
        </a>
      </p>
      <label>
        CSV, XLSX or XLS file (up to 10 MiB)
        <input name="file" type="file" accept=".csv,.xlsx,.xls" required />
      </label>
      <label className="account-check-label">
        <input name="updateExisting" type="checkbox" /> Explicitly update
        matching records
      </label>
      <p>
        First validate the file, review each row and matched record, then
        confirm the import.
      </p>
      <button className="account-primary">Validate & preview</button>
    </form>
  );
}
