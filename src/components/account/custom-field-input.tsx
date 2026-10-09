import type { CustomFieldDefinition } from "@prisma/client";
type Definition = Pick<
  CustomFieldDefinition,
  "fieldKey" | "label" | "dataType" | "isRequired" | "options"
>;
/** Boolean choices are explicit strings so false remains a valid required value on both clients. */
export function CustomFieldInput({
  field,
  value,
}: {
  field: Definition;
  value?: unknown;
}) {
  const name = `custom_${field.fieldKey}`,
    id = `party-${field.fieldKey}`,
    current = value === undefined || value === null ? "" : String(value),
    props = {
      name,
      id,
      required: field.isRequired,
      defaultValue: current,
      "aria-label": field.label,
    };
  let control: React.ReactNode;
  if (field.dataType === "BOOLEAN")
    control = (
      <select {...props}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  else if (field.dataType === "SELECT")
    control = (
      <select {...props}>
        <option value="">Select</option>
        {(Array.isArray(field.options)
          ? field.options.filter((x): x is string => typeof x === "string")
          : []
        ).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  else if (field.dataType === "TEXTAREA")
    control = <textarea {...props} maxLength={10000} />;
  else
    control = (
      <input
        {...props}
        type={
          field.dataType === "DATE"
            ? "date"
            : ["NUMBER", "DECIMAL"].includes(field.dataType)
              ? "number"
              : "text"
        }
        step={
          field.dataType === "DECIMAL"
            ? "0.000001"
            : field.dataType === "NUMBER"
              ? "any"
              : undefined
        }
        maxLength={10000}
      />
    );
  return (
    <label htmlFor={id}>
      {field.label}
      {field.isRequired ? " *" : ""}
      {control}
    </label>
  );
}
