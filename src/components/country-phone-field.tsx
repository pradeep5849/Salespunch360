"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "IN", name: "India", dial: "+91" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
];

function splitPhone(value: string) {
  const cleaned = value.replace(/[^+\\d]/g, "");
  const match = COUNTRIES.filter(country => cleaned.startsWith(country.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  return match ? { code: match.code, local: cleaned.slice(match.dial.length) } : { code: "IN", local: cleaned.replace(/^\\+?91/, "") };
}

export function CountryPhoneField({ name = "phone", id, value, defaultValue = "", onChange, required = false }: {
  name?: string; id?: string; value?: string; defaultValue?: string;
  onChange?: (value: string) => void; required?: boolean;
}) {
  const initial = splitPhone(value ?? defaultValue);
  const [countryCode, setCountryCode] = useState(initial.code);
  const [local, setLocal] = useState(initial.local);
  const dial = COUNTRIES.find(country => country.code === countryCode)?.dial ?? "+91";
  const full = local ? dial + local : "";
  function update(nextCountry: string, nextLocal: string) {
    setCountryCode(nextCountry);
    setLocal(nextLocal);
    const prefix = COUNTRIES.find(country => country.code === nextCountry)?.dial ?? "+91";
    onChange?.(nextLocal ? prefix + nextLocal : "");
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
      <select aria-label="Country calling code" value={countryCode} onChange={event => update(event.target.value, local)} style={{ maxWidth: "48%", minWidth: 110 }}>
        {COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name} ({country.dial})</option>)}
      </select>
      <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="Mobile number" value={local} onChange={event => update(countryCode, event.target.value.replace(/\\D/g, "").slice(0, 15))} placeholder={countryCode === "IN" ? "9876543210" : "Mobile number"} required={required} style={{ minWidth: 0, flex: 1 }} />
      <input type="hidden" name={name} value={value === undefined ? full : value} />
    </div>
  );
}
