import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const read=(path:string)=>readFileSync(path,"utf8");
describe("check-in address presentation",()=>{
 it("uses visit snapshots for pending leads and lead history",()=>{const pending=read("src/app/workspace/leads/page.tsx"),history=read("src/app/workspace/leads/[id]/page.tsx");expect(pending).toContain("v.checkInAddress||");expect(pending).not.toContain("v.customer?.address");expect(history).toContain("v.checkInAddress||");expect(history).toContain("v.checkInLatitude.toFixed(5)");});
 it("uses visit snapshots in dashboard, check-in workspace, reports, and GPS events",()=>{for(const file of["src/app/workspace/page.tsx","src/app/workspace/check-ins/page.tsx","src/app/workspace/check-ins/visit-workspace.tsx","src/app/workspace/reports/check-ins/page.tsx","src/lib/reports/gps.ts"])expect(read(file)).toContain("checkInAddress");});
 it("exports Check-in Address while retaining numeric coordinates",()=>{const excel=read("src/app/api/reports/[report]/excel/route.ts");expect(excel).toContain('"Check-in Address","Latitude","Longitude"');});
 it("removes legacy manual location fields from the normal Customer UI and action",()=>{const ui=read("src/app/workspace/customers/customer-manager.tsx"),action=read("src/app/actions/customers.ts");for(const legacy of['name="address"','name="latitude"','name="longitude"',"No address","Reference location configured"]){expect(ui).not.toContain(legacy);expect(action).not.toContain(legacy);}});
});
