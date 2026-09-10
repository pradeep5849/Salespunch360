import { saveQuotation } from "@/app/actions/quotations";import { QuotationEditor } from "../quotation-editor";
export default function Page(){return <main><h1>New quotation document</h1><QuotationEditor action={saveQuotation}/></main>}
