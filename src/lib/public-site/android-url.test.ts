import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {validatedGooglePlayUrl} from "./android-url";

describe("Google Play destination validation",()=>{
  it("accepts an official HTTPS listing",()=>expect(validatedGooglePlayUrl("https://play.google.com/store/apps/details?id=example")).toBe("https://play.google.com/store/apps/details?id=example"));
  it.each([undefined,"","malformed value","http://play.google.com/store/apps/details?id=example","https://example.com/store/apps/details?id=example","https://play.google.com.example.com/app"])("rejects unsafe or missing configuration: %s",value=>expect(validatedGooglePlayUrl(value)).toBeUndefined());
  it("invokes the framework redirect only after validation",()=>{const page=readFileSync("src/app/(marketing)/android/page.tsx","utf8");expect(page).toContain("const playUrl=validatedGooglePlayUrl");expect(page).toContain("if(playUrl)redirect(playUrl)");expect(page).not.toMatch(/try[\s\S]*?redirect/)});
});
