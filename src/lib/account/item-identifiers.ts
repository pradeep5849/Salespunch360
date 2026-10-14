/** Full random identifiers avoid timestamp collisions; database company uniqueness is authoritative. */
export function generateItemCode(
  kind: "products" | "services",
  uuid = () => crypto.randomUUID(),
) {
  return `${kind === "products" ? "ITEM" : "SER"}-${uuid().toUpperCase()}`;
}

export function rethrowItemIdentifierConflict(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002" &&
    "meta" in error
  ) {
    const meta = error.meta as { target?: unknown } | undefined;
    const target = meta?.target;
    if (
      (Array.isArray(target) &&
        target.some((field) => field === "code" || field === "barcode")) ||
      (typeof target === "string" &&
        /account_(products|services).*_(code|barcode)_/.test(target))
    ) {
      throw new Error("ITEM_IDENTIFIER_EXISTS");
    }
  }
  throw error;
}
