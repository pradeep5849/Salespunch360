import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders the approved logo with accessible home copy", () => {
    const markup = renderToStaticMarkup(<BrandLogo href="/workspace" />);

    expect(markup).toContain('href="/workspace"');
    expect(markup).toContain('aria-label="SalesPunch360 home"');
    expect(markup).toContain('class="brand-logo"');
    expect(markup).toContain("salespunch360-wordmark.webp");
    expect(markup).toContain('alt="SalesPunch360"');
    expect(markup).not.toContain("salespunch360-logo.png");
  });
});
