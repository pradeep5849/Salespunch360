import{afterEach,describe,expect,it,vi}from"vitest";import{NextRequest}from"next/server";import{proxy}from"./proxy";
afterEach(()=>vi.unstubAllEnvs());
function run(url:string,headers:Record<string,string>={},method="GET"){vi.stubEnv("NODE_ENV","production");return proxy(new NextRequest(url,{headers,method}));}
describe("canonical production host",()=>{
 it.each(["GET", "HEAD"])("removes the internal origin port from %s redirects", method => {
   vi.stubEnv("TRUST_PROXY", "true");
   const response = run("http://localhost:3000/sign-in?next=%2Fworkspace", {
     host: "salespunch360.com",
     "x-forwarded-host": "salespunch360.com",
   }, method);
   expect(response.status).toBe(308);
   expect(response.headers.get("location")).toBe("https://www.salespunch360.com/sign-in?next=%2Fworkspace");
   expect(response.headers.get("refresh") ?? "").not.toContain(":3000");
 });

 it("redirects a bare browser host permanently with path and query",()=>{const r=run("https://salespunch360.com/sign-in?next=%2Fworkspace");expect(r.status).toBe(308);expect(r.headers.get("location")).toBe("https://www.salespunch360.com/sign-in?next=%2Fworkspace")});
 it("passes through www without a loop",()=>expect(run("https://www.salespunch360.com/workspace").headers.get("location")).toBeNull());
 it("uses forwarded bare host only when proxy trust is enabled",()=>{vi.stubEnv("TRUST_PROXY","true");expect(run("https://www.salespunch360.com/path",{"x-forwarded-host":"salespunch360.com"}).status).toBe(308)});
 it("passes through a trusted forwarded www host",()=>{vi.stubEnv("TRUST_PROXY","true");expect(run("https://salespunch360.com/path",{"x-forwarded-host":"www.salespunch360.com"}).headers.get("location")).toBeNull()});
 it("ignores forwarded host when proxy trust is disabled",()=>{vi.stubEnv("TRUST_PROXY","false");expect(run("https://www.salespunch360.com/path",{"x-forwarded-host":"salespunch360.com"}).headers.get("location")).toBeNull()});
 it("normalizes the first comma-separated trusted forwarded value",()=>{vi.stubEnv("TRUST_PROXY","true");expect(run("https://www.salespunch360.com/path",{"x-forwarded-host":"salespunch360.com, proxy.internal"}).status).toBe(308)});
 it.each(["bad host","salespunch360.com.attacker.test","salespunch360.com:99999"])("ignores malformed or unknown forwarded host %s",host=>{vi.stubEnv("TRUST_PROXY","true");expect(run("https://www.salespunch360.com/path",{"x-forwarded-host":host}).headers.get("location")).toBeNull()});
 it("does not redirect unknown direct hosts",()=>expect(run("https://preview.example.test/path").headers.get("location")).toBeNull());
 it("returns JSON 421 for bare API requests rather than redirecting",async()=>{const r=run("https://salespunch360.com/api/v1/mobile/attendance");expect(r.status).toBe(421);expect(await r.json()).toEqual({error:"CANONICAL_API_HOST_REQUIRED"})});
 it("preserves bare API host security for mutations",async()=>{const r=run("https://salespunch360.com/api/v1/mobile/attendance",{},"POST");expect(r.status).toBe(421);expect(await r.json()).toEqual({error:"CANONICAL_API_HOST_REQUIRED"})});
 it.each(["POST","PUT","PATCH","DELETE","OPTIONS"])("passes bare-host %s requests through without an application redirect",method=>{const r=run("https://salespunch360.com/sign-in",{"next-action":"action-id"},method);expect(r.headers.get("location")).toBeNull()});
 it("continues to redirect bare-host HEAD requests",()=>expect(run("https://salespunch360.com/sign-in",{},"HEAD").status).toBe(308));
 it("passes canonical www APIs through",()=>expect(run("https://www.salespunch360.com/api/health").status).toBe(200));
 it("keeps localhost usable outside production",()=>{vi.stubEnv("NODE_ENV","development");expect(proxy(new NextRequest("http://localhost:3000/api/health")).headers.get("location")).toBeNull()});
});

describe("public Markdown representation",()=>{
 it("rewrites canonical homepage requests that explicitly accept Markdown",()=>{const r=run("https://www.salespunch360.com/",{accept:"text/markdown"});expect(r.headers.get("x-middleware-rewrite")).toBe("https://www.salespunch360.com/site.md");expect(r.headers.get("vary")).toContain("Accept")});
 it("keeps browser HTML and zero-quality Markdown unchanged",()=>{for(const accept of ["text/html","text/markdown;q=0,text/html"]){expect(run("https://www.salespunch360.com/",{accept}).headers.get("x-middleware-rewrite")).toBeNull()}});
 it("keeps authenticated workspace requests outside content negotiation",()=>expect(run("https://www.salespunch360.com/workspace",{accept:"text/markdown"}).headers.get("x-middleware-rewrite")).toBeNull());
 it("preserves the canonical-host redirect before negotiation",()=>expect(run("https://salespunch360.com/",{accept:"text/markdown"}).status).toBe(308));
});
it("keeps RSC navigation out of Markdown negotiation",()=>{const r=run("https://www.salespunch360.com/",{accept:"text/markdown",rsc:"1"});expect(r.headers.get("x-middleware-rewrite")).toBeNull();expect(r.headers.get("vary")).toContain("RSC")});
