# Report visit contact and read-only details

A136-F02 is implemented pending acceptance. Web check-in cards/advanced table and native personal/admin/advanced visit rows show the stored contact name and phone plus expandable visit details: visitor, type, IST timestamps, duration, saved address/coordinates and accuracy, reference distance, outcome, remarks and notes. Missing legacy snapshots remain explicitly unrecorded; the current customer phone is not substituted into historical visits. Zero coordinates remain valid. Existing report authorization and retrieval scope are unchanged.

A155-F01 remains partial: phone and Details are present; erroneous-visit deletion is still unfinished alongside A136-F01. No Unlink control was added. Check-in creation UI is unchanged.

45 focused checks passed, including three new server-rendered detail cases; TypeScript with a 4 GB heap, changed-file ESLint and whitespace checks passed. Two native formatter tests were added; remote Android build/test/lint and browser/device acceptance remain pending for this revision. Previous pushed c83d09ed passed web, Android, migration and both build Lighthouse checks; live Lighthouse failed. Previous full suite: 4236 passed / 453 optional skipped. No production mutation, migration, deployment or merge.
