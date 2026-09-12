import {describe,expect,it} from "vitest";
import {existsSync,readFileSync} from "node:fs";
import {features} from "./content";

const publicSources=["src/app/(marketing)/page.tsx","src/components/public/public-header.tsx","src/components/public/public-footer.tsx","src/app/(marketing)/products/page.tsx","src/app/(marketing)/features/page.tsx"].map(path=>readFileSync(path,"utf8")).join("\n");
describe("public website navigation",()=>{
  it("contains no placeholder destinations",()=>{expect(publicSources).not.toMatch(/href=["'](?:#|javascript:|)["']/)});
  it("publishes every feature through the checked dynamic route",()=>{expect(existsSync("src/app/(marketing)/features/[slug]/page.tsx")).toBe(true);expect(features.map(feature=>feature.slug)).toHaveLength(13)});
  it("routes Android calls to the permanent local route",()=>{expect(publicSources).toContain('href="/android"');expect(publicSources).not.toMatch(/play\.google\.com/)});
});
