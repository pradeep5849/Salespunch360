import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {inventorySnapshot} from "@/lib/account/inventory";
import {ActiveItemsManager} from "@/components/account/active-items-manager";
export const metadata={title:"Active Items | SalesPunch360"};
export default async function Page({searchParams}:{searchParams:Promise<{mode?:string}>}){
 const {mode}=await searchParams,activate=mode==="activate",actor=await requirePermission("ACCOUNT_STOCK"),companyId=actor.companyId!;
 const [products,services,stock]=await Promise.all([
  db.accountProduct.findMany({where:{companyId,isActive:activate?false:true},orderBy:{name:"asc"},select:{id:true,name:true,code:true}}),
  db.accountService.findMany({where:{companyId,isActive:activate?false:true},orderBy:{name:"asc"},select:{id:true,name:true,code:true}}),
  inventorySnapshot()
 ]);
 const quantities=new Map<string,number>();stock.forEach(x=>quantities.set(x.productId,(quantities.get(x.productId)??0)+Number(x.quantity)));
 return <ActiveItemsManager activate={activate} products={products.map(x=>({...x,stock:quantities.get(x.id)??0}))} services={services.map(x=>({...x,stock:null}))}/>;
}