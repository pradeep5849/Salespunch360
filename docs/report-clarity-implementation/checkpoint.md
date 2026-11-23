# A192/A199 report clarity slice

21 November 2026, continuing PR212. General Ledger adds journal ID, saved line number and line ID tie-breakers after entry date, making same-date running-balance ordering deterministic. No posting/balance formula change.

Projects report now labels Contract Revenue and Billed Profit explicitly and explains that unbilled contract value is excluded from billed profit. Values/formulas and lifetime scope unchanged, avoiding an unapproved change to financial meaning. Twenty existing profit presentation/display/ledger-breakdown checks passed; changed-file lint passed. No new same-day SQL reorder or installed-device acceptance claim; final-head CI remains required.
