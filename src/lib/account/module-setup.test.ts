import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {BASIC_ACCOUNTING_MODULES,BUSINESS_TYPES,MODULE_SETUP_CATALOG,expandSetupModules,optionalModulesFromStored,recommendedSetupModules} from "./module-setup";

describe("two-step Account module setup",()=>{
  it("defines the exact eight stable business keys and clean labels",()=>{
    expect(BUSINESS_TYPES).toEqual([
      {key:"INTERIOR_CONSTRUCTION",label:"Interior / Construction"},{key:"RETAIL_TRADING",label:"Retail / Trading"},{key:"SERVICE_BUSINESS",label:"Service Business"},{key:"MANUFACTURING",label:"Manufacturing"},
      {key:"RESTAURANT_FOOD",label:"Restaurant / Food Business"},{key:"WHOLESALE_DISTRIBUTION",label:"Wholesale / Distribution"},{key:"PROFESSIONAL_CONSULTANCY",label:"Professional / Consultancy"},{key:"OTHER_MIXED",label:"Other / Mixed"},
    ]);
    expect(BUSINESS_TYPES.every(type=>!type.label.includes("_"))).toBe(true);
  });
  it("defines the simplified module list with Multi-Currency last",()=>expect(MODULE_SETUP_CATALOG.map(({key})=>key)).toEqual(["BASIC_ACCOUNTING","PROJECTS","BARCODE","POS","SERVICE_JOB_WORK","MANUFACTURING","PAYROLL_HR","ONLINE_STORE","MULTI_CURRENCY"]));
  it("marks every Coming Soon module unavailable",()=>expect(MODULE_SETUP_CATALOG.filter(x=>!x.available).map(x=>x.key)).toEqual(["SERVICE_JOB_WORK","MANUFACTURING","PAYROLL_HR","ONLINE_STORE","MULTI_CURRENCY"]));
  it("rejects Coming Soon and unknown activation requests",()=>expect(()=>expandSetupModules(["MANUFACTURING"])).toThrow("MODULE_NOT_AVAILABLE:MANUFACTURING"));
  it("keeps Sales, Purchases and Inventory inside Basic Accounting",()=>expect(BASIC_ACCOUNTING_MODULES).toEqual(expect.arrayContaining(["SALES","PURCHASES","INVENTORY"])));
  it("expands Projects independently and Barcode with its Inventory dependency",()=>{
    expect(expandSetupModules(["PROJECTS"])).toEqual(expect.arrayContaining(["PROJECTS","PROJECT_COSTING"]));
    expect(expandSetupModules(["BARCODE"])).toEqual(expect.arrayContaining(["INVENTORY","BARCODE"]));
    expect(expandSetupModules([])).not.toContain("PROJECTS");
  });
  it("maps old workflow arrays without disabling core or inventing optional choices",()=>{
    expect(optionalModulesFromStored(["SALES","PURCHASES","INVENTORY"])).toEqual([]);
    expect(expandSetupModules(optionalModulesFromStored(["SALES","PROJECTS","PROJECT_COSTING"]))).toEqual(expect.arrayContaining(["SALES","PURCHASES","INVENTORY","PROJECTS"]));
  });
  it("keeps recommendations advisory and separate from explicit selections",()=>{
    expect(recommendedSetupModules("RETAIL_TRADING")).toEqual(["BARCODE","POS"]);
    expect(optionalModulesFromStored(expandSetupModules([]))).toEqual([]);
  });
  it("drives both Web and Android from the shared server catalog",()=>{
    const web=readFileSync("src/app/workspace/account/settings/modules/page.tsx","utf8");
    const android=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/account/admin/AccountAdministrationScreen.kt","utf8");
    expect(web).toContain("s.moduleCatalog.map");
    expect(android).toContain('root["catalog"]');
    expect(android).toContain('root["businessTypes"]');
  });
});
