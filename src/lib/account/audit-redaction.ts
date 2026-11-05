export const redactAuditMetadata = (value: unknown): unknown => {
  if (
    value &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof value.toJSON === "function"
  )
    return redactAuditMetadata(value.toJSON());
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /password|secret|token|credential|smtp/i.test(k)
          ? "[REDACTED]"
          : redactAuditMetadata(v),
      ]),
    );
  return value;
};
