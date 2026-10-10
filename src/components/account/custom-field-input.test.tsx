import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomFieldInput } from "./custom-field-input";
const base = {
  fieldKey: "extra",
  label: "Extra field",
  dataType: "TEXT" as const,
  isRequired: true,
  options: null,
};
describe("definition-driven party inputs", () => {
  it("associates required boolean choices and preserves false", () => {
    const html = renderToStaticMarkup(
      <CustomFieldInput
        field={{ ...base, dataType: "BOOLEAN" }}
        value={false}
      />,
    );
    expect(html).toContain("<select");
    expect(html).toContain('required=""');
    expect(html).toContain('value="false" selected=""');
    expect(html).toContain('for="party-extra"');
  });
  it("provides configured select choices rather than free text", () => {
    const html = renderToStaticMarkup(
      <CustomFieldInput
        field={{ ...base, dataType: "SELECT", options: ["Allowed", "Other"] }}
      />,
    );
    expect(html).toContain('value="Allowed"');
    expect(html).not.toContain("<input");
  });
  it("supports fractional numeric and precise decimal steps", () => {
    expect(
      renderToStaticMarkup(
        <CustomFieldInput field={{ ...base, dataType: "NUMBER" }} />,
      ),
    ).toContain('step="any"');
    expect(
      renderToStaticMarkup(
        <CustomFieldInput field={{ ...base, dataType: "DECIMAL" }} />,
      ),
    ).toContain('step="0.000001"');
  });
  it("renders multiline/date controls and retains stored values", () => {
    expect(
      renderToStaticMarkup(
        <CustomFieldInput
          field={{ ...base, dataType: "TEXTAREA" }}
          value={"Two lines\nhere"}
        />,
      ),
    ).toContain("Two lines\nhere</textarea>");
    expect(
      renderToStaticMarkup(
        <CustomFieldInput
          field={{ ...base, dataType: "DATE" }}
          value="2026-10-09"
        />,
      ),
    ).toContain('type="date"');
  });
});
