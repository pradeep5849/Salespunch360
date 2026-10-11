import {db} from "@/lib/db";
import {getAccountSettings} from "@/lib/account/settings";
import {accountMasterOverview} from "@/lib/account/service";
import {AddItemEditor} from "./add-item-editor";

export default async function AddItemPage(){
 const [data,row]=await Promise.all([accountMasterOverview("products",{}),getAccountSettings()]);
 const customFields=row?await db.customFieldDefinition.findMany({where:{companyId:row.companyId,entityType:{in:["PRODUCT","SERVICE"]},isActive:true},orderBy:{position:"asc"}}):[];
 return <AddItemEditor
   units={data.accountUnits.map(x=>({id:x.id,name:x.name,symbol:x.symbol}))}
   categories={data.accountCategories.map(x=>({id:x.id,name:x.name,scope:x.scope}))}
   customFields={customFields}
   settings={(row?.itemSettings??{}) as Record<string,unknown>}
 />;
}
