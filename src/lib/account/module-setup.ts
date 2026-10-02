import type {AccountModule,BusinessType} from "@prisma/client";

export const BUSINESS_TYPES = [
  {key:"INTERIOR_CONSTRUCTION",label:"Interior / Construction"},
  {key:"RETAIL_TRADING",label:"Retail / Trading"},
  {key:"SERVICE_BUSINESS",label:"Service Business"},
  {key:"MANUFACTURING",label:"Manufacturing"},
  {key:"RESTAURANT_FOOD",label:"Restaurant / Food Business"},
  {key:"WHOLESALE_DISTRIBUTION",label:"Wholesale / Distribution"},
  {key:"PROFESSIONAL_CONSULTANCY",label:"Professional / Consultancy"},
  {key:"OTHER_MIXED",label:"Other / Mixed"},
] as const satisfies readonly {key:BusinessType;label:string}[];

export type SetupModuleKey="BASIC_ACCOUNTING"|"PROJECTS"|"BARCODE"|"POS"|"SERVICE_JOB_WORK"|"MANUFACTURING"|"PAYROLL_HR"|"ONLINE_STORE"|"MULTI_CURRENCY"|"LOYALTY_POINTS"|"TRANSACTION_SMS";
export const MODULE_SETUP_CATALOG = [
  {key:"BASIC_ACCOUNTING",label:"Basic Accounting",note:"Included",available:true},
  {key:"PROJECTS",label:"Projects",note:"Project costing, materials, purchases and reports",available:true},
  {key:"BARCODE",label:"Barcode",note:"Requires Inventory",available:true},
  {key:"POS",label:"POS",note:"Point of sale",available:true},
  {key:"SERVICE_JOB_WORK",label:"Service / Job Work",note:"Coming Soon",available:false},
  {key:"MANUFACTURING",label:"Manufacturing",note:"Coming Soon",available:false},
  {key:"PAYROLL_HR",label:"Payroll / HR",note:"Coming Soon",available:false},
  {key:"ONLINE_STORE",label:"Online Store",note:"Coming Soon",available:false},
  {key:"MULTI_CURRENCY",label:"Multi-Currency",note:"Coming Soon",available:false},
  {key:"LOYALTY_POINTS",label:"Loyalty Points",note:"Coming Soon",available:false},
  {key:"TRANSACTION_SMS",label:"Transaction SMS",note:"Coming Soon",available:false},
] as const satisfies readonly {key:SetupModuleKey;label:string;note:string;available:boolean}[];
export const OPTIONAL_SETUP_MODULES=["PROJECTS","BARCODE","POS"] as const satisfies readonly SetupModuleKey[];
export type OptionalSetupModule=typeof OPTIONAL_SETUP_MODULES[number];

export const BASIC_ACCOUNTING_MODULES=["QUOTATIONS_BOQ","SALES","SALES_ORDER","PROFORMA_INVOICE","DELIVERY_CHALLAN","CREDIT_NOTE","CUSTOMER_RECEIPTS","CUSTOMER_ADVANCES","PAYMENT_REMINDERS","PURCHASES","PURCHASE_ORDER","PURCHASE_BILLS","DEBIT_NOTE","VENDOR_PAYMENTS","VENDOR_ADVANCES","SUBCONTRACTORS","EXPENSES","INVENTORY","ASSETS","GST_ADVANCED"] as const satisfies readonly AccountModule[];

const recommendations:Record<BusinessType,readonly OptionalSetupModule[]>={
  INTERIOR_CONSTRUCTION:["PROJECTS"], RETAIL_TRADING:["BARCODE","POS"], SERVICE_BUSINESS:[], MANUFACTURING:[],
  RESTAURANT_FOOD:["POS"], WHOLESALE_DISTRIBUTION:["BARCODE"], PROFESSIONAL_CONSULTANCY:[], OTHER_MIXED:[],
};
export const recommendedSetupModules=(type:BusinessType)=>recommendations[type];
export function optionalModulesFromStored(stored:readonly AccountModule[]):OptionalSetupModule[]{return OPTIONAL_SETUP_MODULES.filter(key=>stored.includes(key))}
export function expandSetupModules(selected:readonly string[]):AccountModule[]{
  const invalid=selected.find(key=>!(OPTIONAL_SETUP_MODULES as readonly string[]).includes(key));
  if(invalid)throw new Error(`MODULE_NOT_AVAILABLE:${invalid}`);
  const unique=new Set(selected);
  const expanded:AccountModule[]=[...BASIC_ACCOUNTING_MODULES];
  if(unique.has("PROJECTS"))expanded.push("PROJECTS","PROJECT_COSTING");
  if(unique.has("BARCODE")){if(!expanded.includes("INVENTORY"))throw new Error("MODULE_DEPENDENCY_REQUIRED:BARCODE:INVENTORY");expanded.push("BARCODE")}
  if(unique.has("POS"))expanded.push("POS");
  return expanded;
}
