"use client";
import { useState } from "react";
import {
  reportPeriodBounds,
  type ReportPeriod,
} from "@/lib/account/reports/dates";
export function ReportDateRange({
  initialFrom,
  initialTo,
  today,
}: {
  initialFrom: string;
  initialTo: string;
  today: string;
}) {
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [period, setPeriod] = useState("CUSTOM");
  return (
    <>
      <label>
        Period
        <select
          aria-label="Report period"
          value={period}
          onChange={(event) => {
            const value = event.target.value;
            setPeriod(value);
            if (value !== "CUSTOM") {
              const range = reportPeriodBounds(value as ReportPeriod, today);
              setFrom(range.from);
              setTo(range.to);
            }
          }}
        >
          <option value="CUSTOM">Custom</option>
          <option value="TODAY">Today</option>
          <option value="THIS_MONTH">This month</option>
          <option value="LAST_MONTH">Last month</option>
          <option value="FINANCIAL_YEAR">Financial year</option>
        </select>
      </label>
      <label>
        From
        <input
          name="from"
          type="date"
          value={from}
          max={to || undefined}
          required
          onChange={(event) => {
            setPeriod("CUSTOM");
            setFrom(event.target.value);
          }}
        />
      </label>
      <label>
        To / As of
        <input
          name="to"
          type="date"
          value={to}
          min={from || undefined}
          required
          onChange={(event) => {
            setPeriod("CUSTOM");
            setTo(event.target.value);
          }}
        />
      </label>
    </>
  );
}
