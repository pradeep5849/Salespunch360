import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

describe("Live Tracking dashboard navigation", () => {
  it("submits its employee selection to the Live Tracking fragment", () => {
    expect(page).toContain('<article id="live-tracking" className="dash-card dashboard-tracking">');
    expect(page).toContain('<form className="dashboard-selector" action="/workspace#live-tracking"><select name="liveEmployee"');
  });

  it("preserves the live employee query and Check-in Activity selection", () => {
    expect(page).toContain('name="liveEmployee" defaultValue={d.liveUserId||""}');
    expect(page).toContain('d.checkUserId&&<input type="hidden" name="checkInEmployee" value={d.checkUserId}/>');
  });

  it("keeps the fragment target clear of the sticky dashboard header", () => {
    expect(css).toContain('.dashboard-tracking{scroll-margin-top:88px}');
  });
});
