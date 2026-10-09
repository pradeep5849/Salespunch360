/** Reject overlong edits before persistence; never silently truncate published content. */
export function boundedPublicText(
  value: FormDataEntryValue | null,
  maximum: number,
) {
  const text = String(value ?? "").trim();
  if (text.length > maximum)
    throw new Error(`Text exceeds the ${maximum}-character limit.`);
  return text;
}
