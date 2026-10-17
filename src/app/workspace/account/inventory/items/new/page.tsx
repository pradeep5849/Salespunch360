import {addItemEditorOptions} from "@/lib/account/add-item-editor-options";
import {AddItemEditor} from "./add-item-editor";
export default async function AddItemPage({searchParams}:{searchParams:Promise<{kind?:string}>}){
 const query=await searchParams;
 return <AddItemEditor {...await addItemEditorOptions()} initialKind={query.kind==="services"?"services":"products"}/>;
}
