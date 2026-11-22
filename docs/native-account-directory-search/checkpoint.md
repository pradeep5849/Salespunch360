# A142-F02 — Native Account directory search continuation

The existing native Account employee list now searches its authorized loaded records by name, email, phone and Account/Sales role, with case-insensitive multi-term matching, result count and an empty-result message. Private IDs, credentials and arbitrary nested data are excluded from search. Clearing the query restores the loaded list; creation/edit controls are unchanged.

Two JVM cases cover matching and private/null-field exclusions. Whitespace passed; native compile/JVM/lint CI and device acceptance are pending. This does not add server directory pagination or claim search over unloaded records: the UI explicitly says loaded employees. A142-F02 remains PARTIAL for server directory paging. No permission/API changes, production data mutation, deployment or merge.
