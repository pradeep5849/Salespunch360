import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {CategoriesManager} from "@/components/account/categories-manager";
export const metadata={title:"Categories | SalesPunch360"};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_STOCK"),companyId=actor.companyId!;
 const [categories,uncategorizedProducts,uncategorizedServices]=await Promise.all([
  db.accountCategory.findMany({where:{companyId,isActive:true},orderBy:{name:"asc"},select:{id:true,name:true,_count:{select:{products:true,services:true}}}}),
  db.accountProduct.count({where:{companyId,isActive:true,categoryId:null}}),
  db.accountService.count({where:{companyId,isActive:true,categoryId:null}})
 ]);
 return <CategoriesManager categories={categories.map(x=>({id:x.id,name:x.name,count:x._count.products+x._count.services}))} uncategorizedCount={uncategorizedProducts+uncategorizedServices}/>;
}