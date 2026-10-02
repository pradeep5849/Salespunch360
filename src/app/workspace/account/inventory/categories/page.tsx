import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {CategoriesManager} from "@/components/account/categories-manager";
export const metadata={title:"Categories | SalesPunch360"};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_STOCK"),companyId=actor.companyId!;
 const [categories,products,services]=await Promise.all([
  db.accountCategory.findMany({where:{companyId,isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}}),
  db.accountProduct.findMany({where:{companyId,isActive:true},select:{categoryId:true}}),
  db.accountService.findMany({where:{companyId,isActive:true},select:{categoryId:true}})
 ]);
 const counts=new Map<string,number>();let uncategorizedCount=0;
 for(const row of [...products,...services]){if(!row.categoryId)uncategorizedCount++;else counts.set(row.categoryId,(counts.get(row.categoryId)??0)+1)}
 return <CategoriesManager categories={categories.map(x=>({id:x.id,name:x.name,count:counts.get(x.id)??0}))} uncategorizedCount={uncategorizedCount}/>;
}
