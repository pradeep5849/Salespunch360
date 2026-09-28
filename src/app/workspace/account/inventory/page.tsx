import {inventorySnapshot,listInventoryProducts} from "@/lib/account/inventory";
import {ItemsScreen} from "@/components/account/items-screen";
export const metadata={title:"Items | SalesPunch360"};
export default async function Page(){
  const [products,stock]=await Promise.all([listInventoryProducts(),inventorySnapshot()]);
  const quantities=new Map<string,number>();
  stock.forEach(row=>quantities.set(row.productId,(quantities.get(row.productId)??0)+Number(row.quantity)));
  return <ItemsScreen items={products.map(p=>({id:p.id,name:p.name,code:p.code,category:p.category?.name??null,salePrice:p.salePrice?.toString()??"0",purchasePrice:p.costPrice?.toString()??"0",stock:quantities.get(p.id)??0}))}/>;
}
