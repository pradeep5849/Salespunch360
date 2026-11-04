"use client";
import { useState } from "react";
export function BackupPreferencesFields({
  auto,
  interval,
  reminder,
  connected,
}: {
  auto: boolean;
  interval: number;
  reminder: number;
  connected: boolean;
}) {
  const [enabled, setEnabled] = useState(auto && connected),
    [days, setDays] = useState(interval),
    [remind, setRemind] = useState(reminder);
  function stepper(
    label: string,
    name: string,
    value: number,
    set: (n: number) => void,
  ) {
    return (
      <div className="general-settings-row">
        <label htmlFor={name}>{label}</label>
        <div className="account-inline-actions">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            disabled={value <= 1}
            onClick={() => set(Math.max(1, value - 1))}
          >
            −
          </button>
          <input
            id={name}
            name={name}
            aria-label={label}
            type="number"
            min="1"
            max="365"
            required
            value={value}
            onChange={(e) =>
              set(e.target.value === "" ? 0 : Number(e.target.value))
            }
          />
          <button
            type="button"
            aria-label={`Increase ${label}`}
            disabled={value >= 365}
            onClick={() => set(Math.min(365, value + 1))}
          >
            +
          </button>
          <span>days</span>
        </div>
      </div>
    );
  }
  return (
    <>
      <label className="general-settings-row">
        <span>Enable auto backup</span>
        <input
          name="autoBackup"
          type="checkbox"
          disabled={!connected}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </label>
      <p>
        Automatic backups use only your personal Google Drive. Connect Google
        Drive before enabling auto backup. No automatic backup is saved to the
        server.
      </p>
      {enabled ? (
        stepper("Auto Backup every", "intervalDays", days, setDays)
      ) : (
        <input type="hidden" name="intervalDays" value={days} />
      )}{" "}
      {stepper(
        "Manual Backup Reminder",
        "manualReminderDays",
        remind,
        setRemind,
      )}
      <p>
        Internet access is required to create or download a backup. Google Drive
        connection must not change your SalesPunch360 login.
      </p>
    </>
  );
}
