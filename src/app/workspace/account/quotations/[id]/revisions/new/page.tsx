import { saveRevision } from "@/app/actions/quotations";import { QuotationEditor } from "../../../quotation-editor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main><h1>New revision</h1><QuotationEditor action={saveRevision.bind(null,id)}/></main>}
