import {getAccountSettings} from "@/lib/account/settings";
import {accountMasterOverview} from "@/lib/account/service";
import {AddItemEditor} from "./add-item-editor";

export default async function AddItemPage(){
 const [data,row]=await Promise.all([accountMasterOverview("products",{}),getAccountSettings()]);
 return <AddItemEditor units={data.accountUnits.map(x=>({id:x.id,name:x.name,symbol:x.symbol}))} settings={(row?.itemSettings??{}) as Record<string,unknown>}/>;
}
