# A118 Period Locks implementation batch

21 November 2026. Based on application 09fb3fc7. A118-F03: shared transaction refuses active closed years before lock/audit writes. Web already offers open years; Android lock picker now filters open years. A118-F02: web consequence review, required confirmation, pending button and explicit success/error state; Android consequence text/confirmation required before submitting. Existing permission and forward-only/transaction rules retained. No real lock advanced.

Validation: 27 focused accounting tests passed, including new closed-year no-write regression; changed web/backend ESLint passed; full TypeScript passed with Node heap 4096 MB (initial default-heap run exhausted memory). Android source changes require CI build/lint and device interaction. A118-F02 remains PARTIAL until native success feedback/current-lock review and UI/device acceptance are complete. A118-F03 implemented but final SQL/platform acceptance remains limited. No FIXED + VERIFIED declaration or deployment.

Native follow-up: selected year bounds/current lock are now shown inside the dialog; date edits reset confirmation; malformed/out-of-bounds/backward dates disable submission. Native server errors stay visible within the open dialog, and successful saves show an explicit status after refresh. Physical Android acceptance remains outstanding.
