export function expenseFormInput(form: FormData) {
  const input = Object.fromEntries(
    [...form.entries()].filter(
      ([key]) => !["id", "saveMode", "operation"].includes(key),
    ),
  ) as Record<string, unknown>;
  if (form.has("roundOffEnabled"))
    input.roundOffEnabled =
      form.get("roundOffEnabled") === "on" ||
      form.get("roundOffEnabled") === "true";
  if (typeof input.billedItems === "string")
    input.billedItems = JSON.parse(input.billedItems);
  return input;
}
