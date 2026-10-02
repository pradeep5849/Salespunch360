import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {UnitsManager} from "@/components/account/units-manager";
export const metadata={title:"Units | SalesPunch360"};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_STOCK"),companyId=actor.companyId!;
 const [units,settings]=await Promise.all([
  db.accountUnit.findMany({where:{companyId,isActive:true},orderBy:{name:"asc"},select:{id:true,name:true,symbol:true,_count:{select:{products:true,services:true}}}}),
  db.accountSettings.findUnique({where:{companyId},select:{itemSettings:true}})
 ]);
 const itemSettings=(settings?.itemSettings??{}) as {unitConversions?:Array<{baseUnitId:string;secondaryUnitId:string;rate:number}>};
 return <UnitsManager units={units.map(x=>({id:x.id,name:x.name,symbol:x.symbol,itemCount:x._count.products+x._count.services}))} conversions={itemSettings.unitConversions??[]}/>;
}