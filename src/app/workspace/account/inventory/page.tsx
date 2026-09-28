import {inventorySnapshot,listInventoryProducts} from "@/lib/account/inventory";
import {ItemsScreen} from "@/components/account/items-screen";
import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {notFound} from "next/navigation";
export const metadata={title:"Items | SalesPunch360"};
export default async function Page(){
  const actor=await requirePermission("ACCOUNT_STOCK");
  const [products,stock,settings]=await Promise.all([listInventoryProducts(),inventorySnapshot(),db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{itemSettings:true}})]),itemSettings=(settings?.itemSettings as {enabled?:boolean;quantityDecimals?:number}|null)??{};
  if(itemSettings.enabled===false)notFound();
  const quantities=new Map<string,number>();
  stock.forEach(row=>quantities.set(row.productId,(quantities.get(row.productId)??0)+Number(row.quantity)));
  return <ItemsScreen quantityDecimals={itemSettings.quantityDecimals??2} canConfigure={actor.accountRole==="ACCOUNT_ADMIN"} items={products.map(p=>({id:p.id,name:p.name,code:p.code,category:p.category?.name??null,salePrice:p.salePrice?.toString()??"0",purchasePrice:p.costPrice?.toString()??"0",stock:quantities.get(p.id)??0}))}/>;
}
