import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {WorkspacePageHeader} from "./workspace-page-header";

describe("WorkspacePageHeader",()=>{it("renders a semantic title and dedicated accessible back action",()=>{const html=renderToStaticMarkup(<WorkspacePageHeader title="Lead detail" backHref="/workspace/leads" backLabel="Back to Leads"/>);expect(html).toContain("<h1>Lead detail</h1>");expect(html).toContain('href="/workspace/leads"');expect(html).toContain('aria-label="Back to Leads"');expect(html).toContain("<svg");expect(html).not.toMatch(/SalesPunch360|<img|>SP</)})});
